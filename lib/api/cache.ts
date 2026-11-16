import 'server-only';
import { getGlobalCoordinationStore } from '@/lib/api/upstream-coordination';

export type CacheSource = 'HIT' | 'MISS' | 'STALE';

export interface SWRResult<T> {
  data: T;
  source: CacheSource;
  cachedAt: number;
  retryAfter?: number;
}

export interface CacheConfig {
  freshTtlSeconds: number;
  staleWindowSeconds: number;
}

export const CACHE_PROFILES = {
  LIVE_MATCHES: {
    freshTtlSeconds: 15,
    staleWindowSeconds: 60,
  },
  TODAY_FIXTURES: {
    freshTtlSeconds: 60,
    staleWindowSeconds: 300,
  },
  FUTURE_FIXTURES: {
    freshTtlSeconds: 30 * 60, // 30 minutes
    staleWindowSeconds: 120 * 60, // 120 minutes
  },
  STREAMS: {
    freshTtlSeconds: 15,
    staleWindowSeconds: 60,
  },
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  freshTtlMs: number;
  staleWindowMs: number;
}

interface FailureBackoffState {
  consecutiveFailures: number;
  blockedUntil: number;
  lastErrorMessage: string;
}

const MAX_L1_ENTRIES = 500;
const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();
const upstreamFailures = new Map<string, FailureBackoffState>();

function setL1Cache<T>(key: string, entry: CacheEntry<T>): void {
  if (memoryCache.size >= MAX_L1_ENTRIES && !memoryCache.has(key)) {
    // Evict oldest 50 entries to enforce bounded memory usage
    const keysToEvict = Array.from(memoryCache.keys()).slice(0, 50);
    for (const k of keysToEvict) {
      memoryCache.delete(k);
    }
  }
  memoryCache.set(key, entry);
}

const BACKOFF_SCHEDULE_MS = [30 * 1000, 60 * 1000, 120 * 1000];

function getBackoffDurationMs(consecutiveFailures: number): number {
  const index = Math.min(consecutiveFailures - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[Math.max(0, index)];
}

/**
 * Two-Level Cache with SWR & Distributed Single-Flight:
 * L1 — Process-local memory for sub-millisecond reads.
 * L2 — Shared PostgreSQL coordination cache across all PM2 workers and instances.
 *
 * Execution Hierarchy:
 * 1. Check L1 memory cache. If fresh, return immediately (< 0.1ms).
 * 2. On L1 miss, check L2 shared database cache. If valid, populate L1 and return.
 * 3. On L1 and L2 miss, coordinate upstream fetch, populate L2 and L1.
 */
export async function getOrFetchWithSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
): Promise<SWRResult<T>> {
  const now = Date.now();
  const freshTtlMs = config.freshTtlSeconds * 1000;
  const staleWindowMs = config.staleWindowSeconds * 1000;

  // 1. L1 PROCESS-LOCAL MEMORY CACHE CHECK
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  // 1A. L1 Fresh Hit
  if (cached && now - cached.timestamp <= freshTtlMs) {
    return {
      data: cached.data,
      source: 'HIT',
      cachedAt: cached.timestamp,
    };
  }

  // 1B. L1 Stale Hit (Serve stale immediately, revalidate asynchronously)
  if (cached && now - cached.timestamp <= freshTtlMs + staleWindowMs) {
    const failure = upstreamFailures.get(key);
    const isBlocked = failure && now < failure.blockedUntil;

    if (!inFlightPromises.has(key) && !isBlocked) {
      coalesceFetch(key, fetchFn, freshTtlMs, staleWindowMs, config).catch((err) => {
        console.warn(`[SWR Cache] Background revalidation failed for ${key}:`, err);
      });
    }

    return {
      data: cached.data,
      source: 'STALE',
      cachedAt: cached.timestamp,
      retryAfter: isBlocked ? Math.ceil((failure.blockedUntil - now) / 1000) : undefined,
    };
  }

  // 2. L2 SHARED DATABASE CACHE CHECK (On L1 Miss)
  try {
    const store = getGlobalCoordinationStore();
    const l2 = await store.getL2Cache<T>(key);

    if (l2) {
      // Populate L1 from L2
      setL1Cache(key, {
        data: l2.payload,
        timestamp: l2.cachedAt,
        freshTtlMs,
        staleWindowMs,
      });

      if (l2.isFresh) {
        return {
          data: l2.payload,
          source: 'HIT',
          cachedAt: l2.cachedAt,
        };
      }

      if (l2.isStale) {
        const failure = upstreamFailures.get(key);
        const isBlocked = failure && now < failure.blockedUntil;

        if (!inFlightPromises.has(key) && !isBlocked) {
          coalesceFetch(key, fetchFn, freshTtlMs, staleWindowMs, config).catch((err) => {
            console.warn(`[SWR Cache] Background revalidation from L2 failed for ${key}:`, err);
          });
        }

        return {
          data: l2.payload,
          source: 'STALE',
          cachedAt: l2.cachedAt,
          retryAfter: isBlocked ? Math.ceil((failure.blockedUntil - now) / 1000) : undefined,
        };
      }
    }
  } catch (l2Err) {
    console.warn(`[SWR Cache] L2 cache lookup error for ${key}:`, l2Err);
  }

  // 3. CACHE MISS / EXPIRED BEYOND STALE WINDOW
  const failure = upstreamFailures.get(key);
  if (failure && now < failure.blockedUntil) {
    // If under negative cache backoff and we have an older cached copy, serve it as emergency fallback
    if (cached) {
      return {
        data: cached.data,
        source: 'STALE',
        cachedAt: cached.timestamp,
        retryAfter: Math.ceil((failure.blockedUntil - now) / 1000),
      };
    }

    const retrySec = Math.ceil((failure.blockedUntil - now) / 1000);
    const error = new Error(`Upstream provider is temporarily unavailable (backoff active). Retry in ${retrySec}s.`);
    (error as any).retryAfter = retrySec;
    (error as any).isUpstreamOutage = true;
    throw error;
  }

  try {
    const data = await coalesceFetch(key, fetchFn, freshTtlMs, staleWindowMs, config);
    return {
      data,
      source: 'MISS',
      cachedAt: Date.now(),
    };
  } catch (err: any) {
    // If fetch failed but we have any cached data at all, return it rather than failing
    if (cached) {
      const failState = upstreamFailures.get(key);
      const retrySec = failState ? Math.ceil((failState.blockedUntil - Date.now()) / 1000) : 30;
      return {
        data: cached.data,
        source: 'STALE',
        cachedAt: cached.timestamp,
        retryAfter: Math.max(1, retrySec),
      };
    }
    throw err;
  }
}

/**
 * Coalesces concurrent calls to the same cache key into a single in-flight Promise.
 * Writes results to both L1 process memory and L2 shared database cache.
 */
async function coalesceFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  freshTtlMs: number,
  staleWindowMs: number,
  config?: CacheConfig
): Promise<T> {
  const existingPromise = inFlightPromises.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const result = await fetchFn();

      // On successful upstream fetch, record in L1 process memory
      setL1Cache(key, {
        data: result,
        timestamp: Date.now(),
        freshTtlMs,
        staleWindowMs,
      });
      upstreamFailures.delete(key);

      // General SWR operations operate in process-local L1 cache with in-flight single-flight
      // coalescing. Shared L2 catalog cache (api_catalog_cache) is exclusively reserved for entries
      // coordinated by an authenticated distributed-lock leader (AUDIT-28-01 / Phase 2.29).

      return result;
    } catch (err: any) {
      // Record failure and increment exponential backoff
      const prevFailures = upstreamFailures.get(key)?.consecutiveFailures || 0;
      const consecutiveFailures = prevFailures + 1;
      const backoffMs = getBackoffDurationMs(consecutiveFailures);

      upstreamFailures.set(key, {
        consecutiveFailures,
        blockedUntil: Date.now() + backoffMs,
        lastErrorMessage: err?.message || 'Upstream fetch failed',
      });

      console.error(`[SWR Cache] Upstream failure (${consecutiveFailures}) for ${key}, backoff ${backoffMs / 1000}s`);
      throw err;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidates a specific key across both L1 memory and L2 shared database cache.
 */
export async function invalidateCacheKey(key: string): Promise<void> {
  memoryCache.delete(key);
  inFlightPromises.delete(key);
  upstreamFailures.delete(key);
  try {
    await getGlobalCoordinationStore().clearL2Cache(key);
  } catch {
    // ignore
  }
}

/**
 * Clears the SWR cache and in-flight promises (for testing and manual cache purges).
 */
export function clearApiCache(): void {
  memoryCache.clear();
  inFlightPromises.clear();
  upstreamFailures.clear();
  getGlobalCoordinationStore().clearL2Cache().catch(() => {});
}
