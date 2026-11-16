/**
 * ZimKickOff Multi-Worker Concurrency Child Process Harness
 * Runs in an isolated OS process with its own V8 heap and module scope.
 */

// Stub server-only for standalone execution before loading server modules
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

async function initChild() {
  const {
    setGlobalCoordinationStore,
    getGlobalCoordinationStore,
    withDistributedSingleFlight,
  } = await import('../lib/api/upstream-coordination');

  const { isSignedUrlExpired } = await import('../lib/api/vnres-catalog');
  const { getOrFetchWithSWR, invalidateCacheKey, clearApiCache, CACHE_PROFILES } = await import('../lib/api/cache');

  const workerId = `worker-${process.pid}`;

  /**
   * Remote HTTP client coordination store for multi-process test harness.
   * Connects the child process to the shared test coordination broker.
   */
  class HttpCoordinationStore {
    private brokerUrl: string;

    constructor(brokerUrl: string) {
      this.brokerUrl = brokerUrl;
    }

    private async request(endpoint: string, body?: any): Promise<any> {
      const res = await fetch(`${this.brokerUrl}${endpoint}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        throw new Error(`Coordination broker HTTP ${res.status}`);
      }
      return res.json();
    }

    async acquireBudgetLease(provider: string, maxRequests = 120, windowSeconds = 60) {
      return this.request('/budget/acquire', { provider, maxRequests, windowSeconds });
    }

    async setCooldown(provider: string, cooldownSeconds = 30, reason?: string) {
      return this.request('/cooldown/set', { provider, cooldownSeconds, reason });
    }

    async recordSuccess(provider: string) {
      return this.request('/cooldown/success', { provider });
    }

    async getStatus(provider: string, maxRequests = 120, windowSeconds = 60) {
      return this.request('/budget/status', { provider, maxRequests, windowSeconds });
    }

    async acquireLock(lockKey: string, ownerId: string, ttlSeconds = 10) {
      const res = await this.request('/lock/acquire', { lockKey, ownerId, ttlSeconds });
      return { acquired: Boolean(res.acquired), fencingToken: Number(res.fencingToken) || 0 };
    }

    async releaseLock(lockKey: string, ownerId: string, fencingToken: number) {
      const res = await this.request('/lock/release', { lockKey, ownerId, fencingToken });
      return res.released;
    }

    async getL2Cache<T = any>(cacheKey: string) {
      return this.request(`/cache/get?key=${encodeURIComponent(cacheKey)}`);
    }

    async setL2Cache<T = any>(
      cacheKey: string,
      payload: T,
      freshSeconds: number,
      staleSeconds: number,
      matchId?: string,
      fixtureKey?: string,
      minTokenExpiryMs?: number | null,
      fencingToken = 0,
      lockKey?: string,
      ownerId?: string
    ) {
      const res = await this.request('/cache/set', {
        cacheKey,
        payload,
        freshSeconds,
        staleSeconds,
        matchId,
        fixtureKey,
        minTokenExpiryMs,
        fencingToken,
        lockKey,
        ownerId,
      });
      return Boolean(res.success);
    }

    async clearL2Cache(cacheKey?: string) {
      return this.request('/cache/clear', { cacheKey });
    }

    async resetAll(provider?: string) {
      return this.request('/reset', { provider });
    }

    async cleanupExpired() {
      return this.request('/cleanup');
    }
  }

  process.on('message', async (msg: any) => {
    const { id, command, payload } = msg;

    try {
      switch (command) {
        case 'init': {
          const store = new HttpCoordinationStore(payload.brokerUrl);
          setGlobalCoordinationStore(store as any);
          clearApiCache();
          process.send?.({ id, result: { status: 'ready', workerId, pid: process.pid } });
          break;
        }

        case 'reserve_budget': {
          const store = getGlobalCoordinationStore();
          const res = await store.acquireBudgetLease(
            payload.provider || 'vnres',
            payload.maxRequests ?? 120,
            payload.windowSeconds ?? 60
          );
          process.send?.({ id, result: res });
          break;
        }

        case 'set_cooldown': {
          const store = getGlobalCoordinationStore();
          const res = await store.setCooldown(
            payload.provider || 'vnres',
            payload.seconds ?? 30,
            payload.reason
          );
          process.send?.({ id, result: res });
          break;
        }

        case 'get_status': {
          const store = getGlobalCoordinationStore();
          const res = await store.getStatus(
            payload.provider || 'vnres',
            payload.maxRequests ?? 120,
            payload.windowSeconds ?? 60
          );
          process.send?.({ id, result: res });
          break;
        }

        case 'acquire_lock': {
          const store = getGlobalCoordinationStore();
          const lockRes = await store.acquireLock(
            payload.lockKey,
            payload.ownerId || workerId,
            payload.ttlSeconds ?? 10
          );
          process.send?.({
            id,
            result: {
              acquired: lockRes.acquired,
              fencingToken: lockRes.fencingToken,
              ownerId: payload.ownerId || workerId,
            },
          });
          break;
        }

        case 'release_lock': {
          const store = getGlobalCoordinationStore();
          const released = await store.releaseLock(
            payload.lockKey,
            payload.ownerId || workerId,
            payload.fencingToken
          );
          process.send?.({ id, result: { released, ownerId: payload.ownerId || workerId } });
          break;
        }

        case 'cleanup': {
          const store = getGlobalCoordinationStore();
          const res = await store.cleanupExpired();
          process.send?.({ id, result: res });
          break;
        }

        case 'single_flight_fetch': {
          const lockKey = payload.lockKey || 'vnres_lock_test';
          const l2CacheKey = payload.l2CacheKey || 'vnres_cat_test';
          let upstreamCalled = false;

          const data = await withDistributedSingleFlight(
            lockKey,
            workerId,
            async () => {
              upstreamCalled = true;
              if (payload.delayMs) {
                await new Promise((r) => setTimeout(r, payload.delayMs));
              }
              if (payload.shouldFail) {
                throw new Error(payload.failMessage || 'Simulated upstream failure in worker');
              }
              return payload.mockData || { matchId: '1738342', streams: [{ id: 's1', url: 'https://pull.niur.live/feed.m3u8' }] };
            },
            {
              l2CacheKey,
              ttlSeconds: payload.ttlSeconds ?? 10,
              waitTimeoutMs: payload.waitTimeoutMs ?? 6500,
              pollIntervalMs: payload.pollIntervalMs ?? 50,
              useBackoff: payload.useBackoff,
              onLeaderSuccess: async (result, context) => {
                const store = getGlobalCoordinationStore();
                await store.setL2Cache(
                  l2CacheKey,
                  result,
                  15,
                  60,
                  undefined,
                  undefined,
                  null,
                  context.fencingToken,
                  context.lockKey,
                  context.ownerId
                );
              },
            }
          );

          process.send?.({ id, result: { data, upstreamCalled, workerId } });
          break;
        }

        case 'read_l2_cache': {
          const store = getGlobalCoordinationStore();
          const data = await store.getL2Cache(payload.key);
          process.send?.({ id, result: data });
          break;
        }

        case 'write_l2_cache': {
          const store = getGlobalCoordinationStore();
          const success = await store.setL2Cache(
            payload.key,
            payload.data,
            payload.freshSeconds || 15,
            payload.staleSeconds || 60,
            payload.matchId,
            payload.fixtureKey,
            payload.minTokenExpiryMs,
            payload.fencingToken,
            payload.lockKey,
            payload.ownerId
          );
          process.send?.({ id, result: { success } });
          break;
        }

        case 'invalidate_cache': {
          await invalidateCacheKey(payload.key);
          process.send?.({ id, result: { success: true } });
          break;
        }

        case 'swr_fetch': {
          let fetchCount = 0;
          const res = await getOrFetchWithSWR(
            payload.key,
            async () => {
              fetchCount++;
              return payload.data;
            },
            payload.config || CACHE_PROFILES.STREAMS
          );
          process.send?.({ id, result: { res, fetchCount } });
          break;
        }

        case 'check_signed_url_expired': {
          const expired = isSignedUrlExpired(payload.url, payload.safetyWindowMs || 30_000);
          process.send?.({ id, result: { expired } });
          break;
        }

        case 'exit': {
          process.send?.({ id, result: { exiting: true } });
          process.exit(0);
          break;
        }

        default:
          process.send?.({ id, error: `Unknown command: ${command}` });
      }
    } catch (err: any) {
      process.send?.({ id, error: err?.message || String(err) });
    }
  });

  // Signal that child process is listening
  if (process.send) {
    process.send({ event: 'online', pid: process.pid });
  }
}

initChild().catch((err) => {
  console.error('[Worker Child] Init error:', err);
  process.exit(1);
});
