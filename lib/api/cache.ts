import 'server-only';

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

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();
const upstreamFailures = new Map<string, FailureBackoffState>();

const BACKOFF_SCHEDULE_MS = [30 * 1000, 60 * 1000, 120 * 1000];

function getBackoffDurationMs(consecutiveFailures: number): number {
  const index = Math.min(consecutiveFailures - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[Math.max(0, index)];
}

/**
 * Executes or coalesces upstream data fetches using In-Process Single-Flight and
 * Stale-While-Revalidate caching with negative cache exponential backoff.
 *
 * NOTE ON MULTI-WORKER ARCHITECTURE:
 * Single-flight coalescing is in-process per PM2 worker. Across the 2 cluster workers,
 * simultaneous misses can result in at most 2 concurrent upstream requests,
 * keeping peak upstream load strictly under 8 requests/minute for live scores.
 */
export async function getOrFetchWithSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
): Promise<SWRResult<T>> {
  const now = Date.now();
  const freshTtlMs = config.freshTtlSeconds * 1000;
  const staleWindowMs = config.staleWindowSeconds * 1000;

  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  // 1. FRESH CACHE HIT
  if (cached && now - cached.timestamp <= freshTtlMs) {
    return {
      data: cached.data,
      source: 'HIT',
      cachedAt: cached.timestamp,
    };
  }

  // 2. STALE CACHE HIT (Serve stale immediately, revalidate asynchronously)
  if (cached && now - cached.timestamp <= freshTtlMs + staleWindowMs) {
    const failure = upstreamFailures.get(key);
    const isBlocked = failure && now < failure.blockedUntil;

    // Trigger background revalidation if not already in-flight and not in exponential backoff
    if (!inFlightPromises.has(key) && !isBlocked) {
      coalesceFetch(key, fetchFn, freshTtlMs, staleWindowMs).catch((err) => {
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
    const data = await coalesceFetch(key, fetchFn, freshTtlMs, staleWindowMs);
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
 */
async function coalesceFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  freshTtlMs: number,
  staleWindowMs: number
): Promise<T> {
  const existingPromise = inFlightPromises.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const result = await fetchFn();

      // On successful upstream fetch, record cache entry and clear any backoff state
      memoryCache.set(key, {
        data: result,
        timestamp: Date.now(),
        freshTtlMs,
        staleWindowMs,
      });
      upstreamFailures.delete(key);

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
 * Clears the SWR cache and in-flight promises (for testing and manual cache purges).
 */
export function clearApiCache(): void {
  memoryCache.clear();
  inFlightPromises.clear();
  upstreamFailures.clear();
}
