import 'server-only';
import {
  initializeGlobalCoordinationStore,
  getCoordinationHealth,
  DegradedFailClosedCoordinationStore,
  withDistributedSingleFlight,
  CoordinationTimeoutError,
} from '@/lib/api/upstream-coordination';
import {
  FootballProviderError,
  ProviderCacheMetadata,
  ProviderResult,
} from './types';

export interface FootballCachePolicy {
  freshTtlSeconds: number;
  staleWindowSeconds: number;
  lockTtlSeconds?: number;
}

interface L1Entry<T> {
  data: T;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
}

const MAX_L1_ENTRIES = 500;
const l1Cache = new Map<string, L1Entry<unknown>>();
const inProcessFlights = new Map<string, Promise<ProviderResult<unknown>>>();

function getWorkerId(): string {
  return process.env.HOSTNAME
    ? `${process.env.HOSTNAME}-${process.pid}`
    : `worker-${process.pid}`;
}

function setL1Entry<T>(key: string, entry: L1Entry<T>): void {
  if (l1Cache.size >= MAX_L1_ENTRIES && !l1Cache.has(key)) {
    const oldest = Array.from(l1Cache.keys()).slice(0, 50);
    for (const k of oldest) {
      l1Cache.delete(k);
    }
  }
  l1Cache.set(key, entry);
}

export function clearFootballProviderL1Cache(): void {
  l1Cache.clear();
  inProcessFlights.clear();
}

/**
 * Narrow coordination adapter bridging the central football provider to
 * ZimKickOff's existing L1 + PostgreSQL L2 (`api_catalog_cache`) +
 * distributed single-flight (`withDistributedSingleFlight`) infrastructure.
 *
 * Guarantees:
 * - Zero competing caches or independent lock tables.
 * - Namespaced cache keys (`football:tsl:*`) and lock keys (`football:lock:tsl:*`).
 * - Never writes failed, malformed, or HTML responses into L1 or L2 caches.
 * - Serves valid L1/L2 stale data if coordination is degraded or upstream fails.
 * - Fails closed (`COORDINATION_UNAVAILABLE`) when coordination is degraded and
 *   no safe cached response exists.
 */
export async function executeCoordinatedFetch<T>(
  resourceKey: string,
  policy: FootballCachePolicy,
  fetchAndMapFn: () => Promise<T>,
  options?: { matchId?: string; fixtureKey?: string }
): Promise<ProviderResult<T>> {
  const cacheKey = `football:tsl:${resourceKey}`;
  const lockKey = `football:lock:tsl:${resourceKey}`;
  const now = Date.now();
  const health = getCoordinationHealth();

  // 1. L1 process-local cache check
  const l1 = l1Cache.get(cacheKey) as L1Entry<T> | undefined;
  if (l1 && now <= l1.freshUntil) {
    return {
      ok: true,
      data: l1.data,
      cache: {
        source: 'L1_HIT',
        cachedAt: l1.cachedAt,
        freshUntil: l1.freshUntil,
        staleUntil: l1.staleUntil,
        degraded: health.degraded,
      },
    };
  }

  // 2. Initialize/recover coordination store (single-flight) & check L2 shared PostgreSQL cache
  const store = await initializeGlobalCoordinationStore();
  let staleCandidate: { data: T; meta: ProviderCacheMetadata } | null = null;

  if (l1 && now <= l1.staleUntil) {
    staleCandidate = {
      data: l1.data,
      meta: {
        source: 'STALE',
        cachedAt: l1.cachedAt,
        freshUntil: l1.freshUntil,
        staleUntil: l1.staleUntil,
        degraded: health.degraded,
      },
    };
  }

  try {
    const l2 = await store.getL2Cache<T>(cacheKey);
    if (l2) {
      const l2Entry: L1Entry<T> = {
        data: l2.payload,
        cachedAt: l2.cachedAt,
        freshUntil: l2.freshUntil,
        staleUntil: l2.staleUntil,
      };
      setL1Entry(cacheKey, l2Entry);

      if (l2.isFresh) {
        return {
          ok: true,
          data: l2.payload,
          cache: {
            source: 'L2_HIT',
            cachedAt: l2.cachedAt,
            freshUntil: l2.freshUntil,
            staleUntil: l2.staleUntil,
            degraded: health.degraded,
          },
        };
      }

      if (l2.isStale) {
        staleCandidate = {
          data: l2.payload,
          meta: {
            source: 'STALE',
            cachedAt: l2.cachedAt,
            freshUntil: l2.freshUntil,
            staleUntil: l2.staleUntil,
            degraded: health.degraded,
          },
        };
      }
    }
  } catch (err: any) {
    console.warn(`[FootballProvider] L2 lookup error for ${cacheKey}:`, err?.message || err);
  }

  // 3. Fail-closed check when production coordination remains degraded after recovery probe (F-32-01)
  const currentHealth = getCoordinationHealth();
  if (store instanceof DegradedFailClosedCoordinationStore) {
    if (staleCandidate) {
      return {
        ok: true,
        data: staleCandidate.data,
        cache: { ...staleCandidate.meta, degraded: true },
      };
    }

    return {
      ok: false,
      error: new FootballProviderError(
        'COORDINATION_UNAVAILABLE',
        currentHealth.reason || 'Global coordination backend is unavailable; upstream fetch blocked.',
        { statusCode: 503, retryAfter: 30, isTransient: true }
      ),
    };
  }

  // 4. In-process single-flight coalescing before hitting distributed lock
  const existingFlight = inProcessFlights.get(cacheKey);
  if (existingFlight) {
    return existingFlight as Promise<ProviderResult<T>>;
  }

  const flightPromise = (async (): Promise<ProviderResult<T>> => {
    let servedFromL2DuringWait = false;
    let l2Meta: ProviderCacheMetadata | null = null;
    let fencedReplacementData: T | null = null;
    let fencedReplacementMeta: ProviderCacheMetadata | null = null;

    try {
      const data = await withDistributedSingleFlight<T>(
        lockKey,
        getWorkerId(),
        fetchAndMapFn,
        {
          l2CacheKey: cacheKey,
          ttlSeconds: policy.lockTtlSeconds ?? 10,
          waitTimeoutMs: 6500,
          onL2Hit: (entry) => {
            servedFromL2DuringWait = true;
            l2Meta = {
              source: entry.isFresh ? 'L2_HIT' : 'STALE',
              cachedAt: entry.cachedAt,
              freshUntil: entry.freshUntil,
              staleUntil: entry.staleUntil,
              degraded: false,
            };
            setL1Entry(cacheKey, {
              data: entry.payload,
              cachedAt: entry.cachedAt,
              freshUntil: entry.freshUntil,
              staleUntil: entry.staleUntil,
            });
          },
          onLeaderSuccess: async (resolvedData, leaderCtx) => {
            const writtenAt = Date.now();
            const freshUntil = writtenAt + policy.freshTtlSeconds * 1000;
            const staleUntil =
              writtenAt + (policy.freshTtlSeconds + policy.staleWindowSeconds) * 1000;

            // F-32-03: Persist to fenced L2 FIRST and respect its boolean outcome before publishing L1
            const l2Written = await store.setL2Cache<T>(
              cacheKey,
              resolvedData,
              policy.freshTtlSeconds,
              policy.staleWindowSeconds,
              options?.matchId,
              options?.fixtureKey,
              null,
              leaderCtx.fencingToken,
              leaderCtx.lockKey,
              leaderCtx.ownerId
            );

            if (l2Written) {
              setL1Entry(cacheKey, {
                data: resolvedData,
                cachedAt: writtenAt,
                freshUntil,
                staleUntil,
              });
              return;
            }

            // Rejected by L2 fencing (stale lock holder): never publish stale result into L1.
            // If a newer winning leader already wrote fresh data to L2, adopt that entry.
            const latestL2 = await store.getL2Cache<T>(cacheKey).catch(() => null);
            if (latestL2 && latestL2.isFresh) {
              setL1Entry(cacheKey, {
                data: latestL2.payload,
                cachedAt: latestL2.cachedAt,
                freshUntil: latestL2.freshUntil,
                staleUntil: latestL2.staleUntil,
              });
              fencedReplacementData = latestL2.payload;
              fencedReplacementMeta = {
                source: 'L2_HIT',
                cachedAt: latestL2.cachedAt,
                freshUntil: latestL2.freshUntil,
                staleUntil: latestL2.staleUntil,
                degraded: false,
              };
            }
          },
        }
      );

      if (servedFromL2DuringWait && l2Meta) {
        return { ok: true, data, cache: l2Meta };
      }

      if (fencedReplacementData !== null && fencedReplacementMeta !== null) {
        return { ok: true, data: fencedReplacementData, cache: fencedReplacementMeta };
      }

      const cachedNow = Date.now();
      return {
        ok: true,
        data,
        cache: {
          source: 'UPSTREAM',
          cachedAt: cachedNow,
          freshUntil: cachedNow + policy.freshTtlSeconds * 1000,
          staleUntil:
            cachedNow + (policy.freshTtlSeconds + policy.staleWindowSeconds) * 1000,
          degraded: false,
        },
      };
    } catch (err: unknown) {
      const providerErr =
        err instanceof FootballProviderError
          ? err
          : err instanceof CoordinationTimeoutError
            ? new FootballProviderError(
                'COORDINATION_UNAVAILABLE',
                err.message,
                { statusCode: 503, retryAfter: err.retryAfter, isTransient: true }
              )
            : new FootballProviderError(
                'UPSTREAM_HTTP_ERROR',
                err instanceof Error ? err.message : 'Unexpected upstream provider error.',
                { statusCode: 503, retryAfter: 15, isTransient: true }
              );

      // Serve safe stale data if available rather than failing completely
      if (staleCandidate) {
        return {
          ok: true,
          data: staleCandidate.data,
          cache: { ...staleCandidate.meta, degraded: true },
        };
      }

      return {
        ok: false,
        error: providerErr,
      };
    } finally {
      inProcessFlights.delete(cacheKey);
    }
  })();

  inProcessFlights.set(cacheKey, flightPromise as Promise<ProviderResult<unknown>>);
  return flightPromise;
}
