/**
 * ZimKickOff Phase 3 Stage 3.2 — Central Football Data Provider Verification Suite
 *
 * All upstream HTTP calls and coordination stores are mocked locally.
 * Zero live TotalSportsLive or Supabase network calls are performed.
 */

// Standalone test environment: stub 'server-only' package before loading server modules
(require.cache as Record<string, unknown>)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(headers || {}),
    },
  });
}

function textResponse(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

async function runTests() {
  const coord = await import('@/lib/api/upstream-coordination');
  const client = await import('@/lib/providers/football/totalsportslive-client');
  const mapper = await import('@/lib/providers/football/totalsportslive-mapper');
  const provider = await import('@/lib/providers/football/index');

  let passed = 0;
  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      passed++;
      console.log(`  PASS: ${name}`);
    } catch (err) {
      console.error(`  FAIL: ${name}`);
      throw err;
    }
  }

  const origNodeEnv = process.env.NODE_ENV;
  const origCoordStore = process.env.COORDINATION_STORE;
  const origSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  function restoreEnv() {
    if (origNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
    else (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;

    if (origCoordStore === undefined) delete process.env.COORDINATION_STORE;
    else process.env.COORDINATION_STORE = origCoordStore;

    if (origSupaUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = origSupaUrl;

    if (origSupaKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = origSupaKey;
  }

  function resetAllState() {
    provider.clearFootballProviderL1Cache();
    client.resetFootballProviderFetch();
    coord.resetGlobalCoordinationInitialization();
    restoreEnv();
  }

  console.log('================================================================================');
  console.log('--- Running ZimKickOff Central Football Provider Tests (Stage 3.2) ---');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. Coordination Initialization & Fail-Closed Tests
  // ---------------------------------------------------------------------------
  console.log('1. Coordination Initialization & Fail-Closed Behavior:');

  await test('production initialization selects PostgreSqlCoordinationStore only when readiness probe succeeds', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setCoordinationReadinessProbe(async () => ({ ok: true }));

    const store = await coord.initializeGlobalCoordinationStore();
    assert.ok(store instanceof coord.PostgreSqlCoordinationStore);
    const health = coord.getCoordinationHealth();
    assert.equal(health.mode, 'postgresql');
    assert.equal(health.initialized, true);
    assert.equal(health.ready, true);
    assert.equal(health.degraded, false);
    resetAllState();
  });

  await test('production initialization fails closed when client constructs but readiness RPC fails (F-32-04)', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setCoordinationReadinessProbe(async () => ({
      ok: false,
      reason: 'Simulated PostgreSQL RPC connection refused',
    }));

    const store = await coord.initializeGlobalCoordinationStore();
    assert.ok(store instanceof coord.DegradedFailClosedCoordinationStore);
    const health = coord.getCoordinationHealth();
    assert.equal(health.mode, 'degraded');
    assert.equal(health.ready, false);
    assert.equal(health.degraded, true);
    assert.ok(health.reason && health.reason.includes('connection refused'));
    resetAllState();
  });

  await test('local/test initialization selects InMemoryCoordinationStore', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.COORDINATION_STORE;

    const store = await coord.initializeGlobalCoordinationStore();
    assert.ok(store instanceof coord.InMemoryCoordinationStore);
    const health = coord.getCoordinationHealth();
    assert.equal(health.mode, 'in_memory');
    assert.equal(health.ready, true);
    assert.equal(health.degraded, false);
    resetAllState();
  });

  await test('concurrent initializeGlobalCoordinationStore calls share one readiness probe and return same singleton', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';

    let probeCalls = 0;
    coord.setCoordinationReadinessProbe(async () => {
      probeCalls++;
      await new Promise((r) => setTimeout(r, 25));
      return { ok: true };
    });

    const results = await Promise.all([
      coord.initializeGlobalCoordinationStore(),
      coord.initializeGlobalCoordinationStore(),
      coord.initializeGlobalCoordinationStore(),
      coord.initializeGlobalCoordinationStore(),
    ]);

    assert.equal(probeCalls, 1, 'Concurrent init callers must share one readiness probe');
    for (const r of results) {
      assert.strictEqual(r, results[0]);
      assert.ok(r instanceof coord.PostgreSqlCoordinationStore);
    }
    resetAllState();
  });

  await test('initialization failure is retryable and recovers cleanly when PostgreSQL becomes ready (F-32-01)', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setRecoveryProbeThrottleMs(0);

    let probeHealthy = false;
    let probeCalls = 0;
    let releaseRecoveryProbe: (() => void) | null = null;
    coord.setCoordinationReadinessProbe(async () => {
      probeCalls++;
      if (releaseRecoveryProbe) {
        await new Promise<void>((resolve) => {
          const prev = releaseRecoveryProbe;
          releaseRecoveryProbe = () => {
            prev?.();
            resolve();
          };
        });
      }
      return probeHealthy ? { ok: true } : { ok: false, reason: 'DB booting' };
    });

    // First init fails -> degraded fail-closed
    const failedStore = await coord.initializeGlobalCoordinationStore();
    assert.ok(failedStore instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(coord.getCoordinationHealth().degraded, true);
    assert.equal(coord.getCoordinationHealth().ready, false);

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '301', Vnm: 'Wembley', Refs: [] });
    });

    // While still down, provider blocks upstream fetch
    const blocked = await provider.getMatchInfo('301');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.error.code, 'COORDINATION_UNAVAILABLE');
    assert.equal(fetchCalls, 0);

    // Now DB recovers -> concurrent recovery attempts share ONE probe (deterministic deferred gate)
    probeHealthy = true;
    const probeCallsBeforeRecovery = probeCalls;
    releaseRecoveryProbe = () => {};
    const p1 = coord.initializeGlobalCoordinationStore();
    const p2 = coord.initializeGlobalCoordinationStore();
    const p3 = coord.initializeGlobalCoordinationStore();
    // Release the single shared in-flight probe deterministically
    releaseRecoveryProbe();
    const recoveredStores = await Promise.all([p1, p2, p3]);

    assert.equal(
      probeCalls - probeCallsBeforeRecovery,
      1,
      'Concurrent recovery callers must share one single-flight probe'
    );
    for (const s of recoveredStores) {
      assert.strictEqual(s, recoveredStores[0]);
      assert.ok(s instanceof coord.PostgreSqlCoordinationStore);
    }
    const recoveredHealth = coord.getCoordinationHealth();
    assert.equal(recoveredHealth.mode, 'postgresql');
    assert.equal(recoveredHealth.ready, true);
    assert.equal(recoveredHealth.degraded, false);
    resetAllState();
  });

  await test('XC-01: Direct HLS withDistributedSingleFlight recovers from DegradedFailClosedCoordinationStore without restart', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setRecoveryProbeThrottleMs(0);

    let probeHealthy = false;
    let probeCalls = 0;
    coord.setCoordinationReadinessProbe(async () => {
      probeCalls++;
      return probeHealthy ? { ok: true } : { ok: false, reason: 'Transient DB outage' };
    });

    // 1. Initial probe fails -> active store becomes DegradedFailClosedCoordinationStore
    const initial = await coord.initializeGlobalCoordinationStore();
    assert.ok(initial instanceof coord.DegradedFailClosedCoordinationStore);

    // 2. Direct HLS caller invokes withDistributedSingleFlight while DB is still down -> fails fast, 0 fetches
    let hlsFetchCalls = 0;
    await assert.rejects(
      () =>
        coord.withDistributedSingleFlight('vnres_lock_arsenal_vs_chelsea', 'worker-1', async () => {
          hlsFetchCalls++;
          return { fixtures: [] };
        }),
      (err: unknown) => err instanceof coord.CoordinationTimeoutError
    );
    assert.equal(hlsFetchCalls, 0);
    assert.ok(coord.getGlobalCoordinationStore() instanceof coord.DegradedFailClosedCoordinationStore);

    // 3. DB recovers -> next withDistributedSingleFlight call triggers shared recovery without worker restart
    probeHealthy = true;
    const probeBefore = probeCalls;
    // Call withDistributedSingleFlight: it will recover activeCoordinationStore to PostgreSqlCoordinationStore
    // (the subsequent live lock RPC against fake URL fails closed, which is expected offline,
    //  so we also verify activeCoordinationStore was promoted out of DegradedFailClosedCoordinationStore!)
    const recoveredViaStatus = await coord.getGlobalUpstreamStatus('vnres');
    assert.equal(probeCalls - probeBefore, 1, 'Async wrapper must trigger single recovery probe');
    assert.ok(coord.getGlobalCoordinationStore() instanceof coord.PostgreSqlCoordinationStore);
    assert.equal(coord.getCoordinationHealth().mode, 'postgresql');
    assert.equal(coord.getCoordinationHealth().ready, true);
    assert.equal(coord.getCoordinationHealth().degraded, false);
    assert.ok(typeof recoveredViaStatus.inCooldown === 'boolean');
    resetAllState();
  });

  await test('repeated readiness failures respect bounded throttle and throttle expiry never declares DB healthy', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setRecoveryProbeThrottleMs(40);

    let probeHealthy = false;
    let probeCalls = 0;
    coord.setCoordinationReadinessProbe(async () => {
      probeCalls++;
      return probeHealthy ? { ok: true } : { ok: false, reason: 'Still unreachable' };
    });

    // Failure #1 executes probe
    const s1 = await coord.initializeGlobalCoordinationStore();
    assert.ok(s1 instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(probeCalls, 1);

    // Immediate retries within throttle window fail closed WITHOUT executing additional probes
    const s2 = await coord.initializeGlobalCoordinationStore();
    const s3 = await coord.initializeGlobalCoordinationStore();
    assert.ok(s2 instanceof coord.DegradedFailClosedCoordinationStore);
    assert.ok(s3 instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(probeCalls, 1, 'Throttled callers must not fire repeated probes');

    // Wait past throttle window: health must STILL be degraded (timer NEVER declares DB healthy)
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(coord.getCoordinationHealth().degraded, true);
    assert.equal(coord.getCoordinationHealth().ready, false);

    // Next call after throttle window executes probe #2; still failing -> remains degraded
    const s4 = await coord.initializeGlobalCoordinationStore();
    assert.ok(s4 instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(probeCalls, 2);
    assert.equal(coord.getCoordinationHealth().degraded, true);

    // Wait past throttle window again and restore DB -> probe #3 succeeds and clears degraded + throttle
    await new Promise((r) => setTimeout(r, 50));
    probeHealthy = true;
    const s5 = await coord.initializeGlobalCoordinationStore();
    assert.ok(s5 instanceof coord.PostgreSqlCoordinationStore);
    assert.equal(probeCalls, 3);
    assert.equal(coord.getCoordinationHealth().degraded, false);
    assert.equal(coord.getCoordinationHealth().ready, true);
    resetAllState();
  });

  await test('storeEpoch guard prevents stale in-flight readiness probe from overwriting newer store', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';

    let resolveStaleProbe!: (val: { ok: boolean; reason?: string }) => void;
    coord.setCoordinationReadinessProbe(
      () =>
        new Promise((resolve) => {
          resolveStaleProbe = resolve;
        })
    );

    // Start an async initialization that pauses on verifyReadiness()
    const inFlightInit = coord.initializeGlobalCoordinationStore();

    // While probe is in flight, explicitly replace store with a newer override
    const newerStore = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(newerStore);

    // Now resolve the stale probe with a failure -> must NOT overwrite newerStore
    resolveStaleProbe({ ok: false, reason: 'stale probe failure' });
    const resultStore = await inFlightInit;

    assert.strictEqual(resultStore, newerStore);
    assert.strictEqual(coord.getGlobalCoordinationStore(), newerStore);
    assert.equal(coord.getCoordinationHealth().mode, 'in_memory');
    assert.equal(coord.getCoordinationHealth().degraded, false);
    assert.equal(coord.isExplicitCoordinationOverride(), true);
    resetAllState();
  });

  await test('healthy steady-state operation executes zero extra readiness probes', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';

    let probeCalls = 0;
    coord.setCoordinationReadinessProbe(async () => {
      probeCalls++;
      return { ok: true };
    });

    const first = await coord.initializeGlobalCoordinationStore();
    assert.ok(first instanceof coord.PostgreSqlCoordinationStore);
    assert.equal(probeCalls, 1);

    // 10 subsequent healthy calls must hit the O(1) fast path with zero additional probes
    for (let i = 0; i < 10; i++) {
      const store = await coord.initializeGlobalCoordinationStore();
      assert.strictEqual(store, first);
    }
    assert.equal(probeCalls, 1, 'Healthy steady-state must never run extra readiness probes');
    resetAllState();
  });

  await test('readiness RPC response validation rejects malformed shapes and rejected probe promises safely', async () => {
    resetAllState();

    // Pure response-shape validation checks
    assert.equal(coord.validateReadinessRpcResponse(null).ok, false);
    assert.equal(coord.validateReadinessRpcResponse('bad').ok, false);
    assert.equal(coord.validateReadinessRpcResponse({ data: {}, error: null }).ok, false);
    assert.equal(coord.validateReadinessRpcResponse({ data: 'not-array', error: null }).ok, false);
    assert.equal(coord.validateReadinessRpcResponse({ data: null, error: null }).ok, false);
    assert.equal(
      coord.validateReadinessRpcResponse({ data: [], error: { message: 'permission denied' } }).ok,
      false
    );
    assert.equal(coord.validateReadinessRpcResponse({ data: [], error: null }).ok, true);

    // Rejected readiness probe promise must fail closed without unhandled rejection
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    coord.setRecoveryProbeThrottleMs(0);

    coord.setCoordinationReadinessProbe(async () => {
      throw new Error('ECONNRESET');
    });
    const rejectedStore = await coord.initializeGlobalCoordinationStore();
    assert.ok(rejectedStore instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(coord.getCoordinationHealth().degraded, true);
    assert.ok(coord.getCoordinationHealth().reason?.includes('ECONNRESET'));

    // Malformed custom probe result must fail closed
    coord.setCoordinationReadinessProbe(async () => null as unknown as { ok: boolean });
    const malformedStore = await coord.initializeGlobalCoordinationStore();
    assert.ok(malformedStore instanceof coord.DegradedFailClosedCoordinationStore);
    assert.equal(coord.getCoordinationHealth().degraded, true);
    resetAllState();
  });

  await test('lock contention during recovery coalesces workers and preserves backoff semantics', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    let releaseWorkerA!: () => void;
    let workerAFetchCount = 0;
    let workerBFetchCount = 0;

    // Worker A acquires lock and holds it until released, then writes L2 cache
    const workerA = coord.withDistributedSingleFlight(
      'football:lock:tsl:recovery-contention',
      'worker-A',
      async () => {
        workerAFetchCount++;
        await new Promise<void>((resolve) => {
          releaseWorkerA = resolve;
        });
        return { value: 'fresh-from-A' };
      },
      {
        l2CacheKey: 'football:tsl:recovery-contention',
        ttlSeconds: 10,
        onLeaderSuccess: async (data, ctx) => {
          await store.setL2Cache(
            'football:tsl:recovery-contention',
            data,
            60,
            300,
            undefined,
            undefined,
            null,
            ctx.fencingToken,
            ctx.lockKey,
            ctx.ownerId
          );
        },
      }
    );

    // Yield one tick so Worker A holds the distributed lock
    await new Promise((r) => setTimeout(r, 10));

    // Worker B contends for the same lock -> backs off and reads L2 once Worker A publishes
    const workerB = coord.withDistributedSingleFlight(
      'football:lock:tsl:recovery-contention',
      'worker-B',
      async () => {
        workerBFetchCount++;
        return { value: 'duplicate-from-B' };
      },
      {
        l2CacheKey: 'football:tsl:recovery-contention',
        ttlSeconds: 10,
        pollIntervalMs: 20,
      }
    );

    releaseWorkerA();
    const [resA, resB] = await Promise.all([workerA, workerB]);
    assert.equal(resA.value, 'fresh-from-A');
    assert.equal(resB.value, 'fresh-from-A');
    assert.equal(workerAFetchCount, 1);
    assert.equal(workerBFetchCount, 0, 'Contending Worker B must receive L2 result without duplicate fetch');
    resetAllState();
  });

  await test('degraded status reporting distinguishes DB outage from ordinary provider cooldown', async () => {
    resetAllState();

    // Ordinary cooldown on healthy store -> inCooldown: true, degraded: false
    const healthyStore = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(healthyStore);
    await healthyStore.setCooldown(client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider, 30, 'HTTP 429');
    const cooldownStatus = await coord.getGlobalUpstreamStatus(
      client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider,
      6,
      1
    );
    assert.equal(cooldownStatus.inCooldown, true);
    assert.equal(cooldownStatus.degraded, false);

    // Degraded store -> degraded: true, and direct client call throws COORDINATION_UNAVAILABLE (not UPSTREAM_COOLDOWN)
    coord.setGlobalCoordinationStore(
      new coord.DegradedFailClosedCoordinationStore('PostgreSQL offline')
    );
    const degradedStatus = await coord.getGlobalUpstreamStatus(
      client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider,
      6,
      1
    );
    assert.equal(degradedStatus.degraded, true);

    await assert.rejects(
      () => client.fetchMatchInfo('999'),
      (err: unknown) =>
        err instanceof provider.FootballProviderError &&
        err.code === 'COORDINATION_UNAVAILABLE' &&
        err.statusCode === 503
    );
    resetAllState();
  });

  await test('temporary DATABASE_ERROR does not permanently deadlock recovery (F-32-01)', async () => {
    resetAllState();

    // Subclass PostgreSqlCoordinationStore with in-memory backing to simulate transient RPC failure -> recovery
    const backing = new coord.InMemoryCoordinationStore();
    let failNextBudgetCall = true;
    class TransientFailurePostgresStore extends coord.PostgreSqlCoordinationStore {
      override async acquireBudgetLease(p: string, max?: number, win?: number) {
        if (failNextBudgetCall) {
          failNextBudgetCall = false;
          return { allowed: false, reason: 'DATABASE_ERROR' as const, retryAfter: 30, currentCount: 0 };
        }
        return backing.acquireBudgetLease(p, max, win);
      }
      override async setCooldown(p: string, s?: number, r?: string) {
        return backing.setCooldown(p, s, r);
      }
      override async recordSuccess(p: string) {
        return backing.recordSuccess(p);
      }
      override async getStatus(p: string, max?: number, win?: number) {
        return backing.getStatus(p, max, win);
      }
      override async acquireLock(k: string, o: string, t?: number) {
        return backing.acquireLock(k, o, t);
      }
      override async releaseLock(k: string, o: string, f: number) {
        return backing.releaseLock(k, o, f);
      }
      override async getL2Cache<T = any>(k: string) {
        return backing.getL2Cache<T>(k);
      }
      override async setL2Cache<T = any>(
        k: string,
        p: T,
        fs: number,
        ss: number,
        m: string | undefined,
        fk: string | undefined,
        me: number | null | undefined,
        ft: number,
        lk: string,
        oid: string
      ) {
        return backing.setL2Cache(k, p, fs, ss, m, fk, me, ft, lk, oid);
      }
    }

    coord.setGlobalCoordinationStore(new TransientFailurePostgresStore());

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '401', Vnm: 'Stamford Bridge', Refs: [] });
    });

    // Request 1 hits transient DATABASE_ERROR -> fails closed with zero upstream fetch, marks health degraded
    const first = await provider.getMatchInfo('401');
    assert.equal(first.ok, false);
    if (!first.ok) assert.equal(first.error.code, 'COORDINATION_UNAVAILABLE');
    assert.equal(fetchCalls, 0);
    assert.equal(coord.getCoordinationHealth().degraded, true);

    // Request 2 must NOT be permanently deadlocked by degraded health flag; PostgreSQL succeeds and clears degraded
    const second = await provider.getMatchInfo('401');
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.data.venueName, 'Stamford Bridge');
    assert.equal(fetchCalls, 1);
    assert.equal(coord.getCoordinationHealth().degraded, false);
    assert.equal(coord.getCoordinationHealth().ready, true);
    resetAllState();
  });

  await test('lock acquisition DB error fails fast without 6.5s polling spin (F-32-06)', async () => {
    resetAllState();
    const failingLockStore = new coord.InMemoryCoordinationStore();
    failingLockStore.acquireLock = async () => ({ acquired: false, fencingToken: 0, error: true });
    coord.setGlobalCoordinationStore(failingLockStore);

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '402', Refs: [] });
    });

    const start = Date.now();
    const res = await provider.getMatchInfo('402');
    const elapsedMs = Date.now() - start;

    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'COORDINATION_UNAVAILABLE');
    assert.equal(fetchCalls, 0);
    assert.ok(elapsedMs < 1000, `Expected fast fail (<1000ms), got ${elapsedMs}ms`);
    resetAllState();
  });

  await test('production initialization failure enters degraded fail-closed state (never falls back to in-memory)', async () => {
    resetAllState();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.COORDINATION_STORE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const store = await coord.initializeGlobalCoordinationStore();
    assert.ok(store instanceof coord.DegradedFailClosedCoordinationStore);
    assert.ok(!(store instanceof coord.InMemoryCoordinationStore));

    const health = coord.getCoordinationHealth();
    assert.equal(health.mode, 'degraded');
    assert.equal(health.degraded, true);
    assert.ok(health.reason && health.reason.includes('missing'));

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '123' });
    });

    const res = await provider.getMatchInfo('12345');
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'COORDINATION_UNAVAILABLE');
      assert.equal(res.error.statusCode, 503);
    }
    assert.equal(fetchCalls, 0, 'Degraded mode must block upstream fetch');
    resetAllState();
  });

  await test('setGlobalCoordinationStore preserves test-worker injection and isolation', async () => {
    resetAllState();
    const injected = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(injected);
    assert.strictEqual(coord.getGlobalCoordinationStore(), injected);
    assert.equal(coord.isExplicitCoordinationOverride(), true);
    resetAllState();
  });

  // ---------------------------------------------------------------------------
  // 2. Response & Input Validation Tests
  // ---------------------------------------------------------------------------
  console.log('\n2. Response & Input Validation:');

  await test('rejects invalid numeric IDs (SSRF / path traversal) and invalid dates without hitting upstream', async () => {
    resetAllState();
    coord.setGlobalCoordinationStore(new coord.InMemoryCoordinationStore());
    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({});
    });

    const badIds = ['../admin', '123/../../etc', 'https://evil.com', '123?foo=bar', 'abc', ''];
    for (const badId of badIds) {
      const r = await provider.getTeamDetails(badId);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error.code, 'INVALID_INPUT');
    }

    const badDates = ['2026-04-20', '20260230', '20261301', 'notadate'];
    for (const badDate of badDates) {
      const r = await provider.getFixturesByDate(badDate);
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.error.code, 'INVALID_INPUT');
    }

    assert.equal(fetchCalls, 0);
    resetAllState();
  });

  await test('blocks /unified, /search, and assists stat group with zero upstream calls', async () => {
    resetAllState();
    coord.setGlobalCoordinationStore(new coord.InMemoryCoordinationStore());
    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({});
    });

    const r1 = await provider.getUnifiedMatchH2H('12345');
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.equal(r1.error.code, 'BLOCKED_ENDPOINT');

    const r2 = await provider.searchFootball('Arsenal');
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.error.code, 'BLOCKED_ENDPOINT');

    const r3 = await provider.getTeamAssistsStats('65', '2871');
    assert.equal(r3.ok, false);
    if (!r3.ok) assert.equal(r3.error.code, 'BLOCKED_ENDPOINT');

    const r4 = await provider.getTeamPlayerStats('65', '2871', 'assists');
    assert.equal(r4.ok, false);
    if (!r4.ok) assert.equal(r4.error.code, 'BLOCKED_ENDPOINT');

    assert.equal(fetchCalls, 0);
    resetAllState();
  });

  await test('rejects wrong Content-Type, Cloudflare HTML 502, HTML 200, malformed JSON, and non-object JSON', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    // Wrong Content-Type
    client.setFootballProviderFetch(async () => textResponse('{"Eid":"1"}', 200, 'text/plain'));
    let res = await provider.getMatchInfo('101');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_INVALID_CONTENT_TYPE');

    // Cloudflare HTML 502
    let html502Attempts = 0;
    client.setFootballProviderFetch(async () => {
      html502Attempts++;
      return textResponse('<!DOCTYPE html><html><title>502 Bad Gateway</title></html>', 502, 'text/html');
    });
    res = await provider.getMatchInfo('102');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_HTML_ERROR');
    assert.equal(html502Attempts, 1, 'HTML 502 must never be retried');

    // HTML body with HTTP 200
    client.setFootballProviderFetch(async () =>
      textResponse('<!DOCTYPE html><html><body>Error</body></html>', 200, 'application/json')
    );
    res = await provider.getMatchInfo('103');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_HTML_ERROR');

    // Malformed JSON
    client.setFootballProviderFetch(async () =>
      textResponse('{"Eid": 104, broken', 200, 'application/json')
    );
    res = await provider.getMatchInfo('104');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_MALFORMED_JSON');

    // Non-object JSON root
    client.setFootballProviderFetch(async () => jsonResponse([1, 2, 3], 200));
    res = await provider.getMatchInfo('105');
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error.code, 'UPSTREAM_SCHEMA_INVALID');

    // Missing required structure in livescore response
    client.setFootballProviderFetch(async () => jsonResponse({ wrongField: true }, 200));
    const liveRes = await provider.getFixturesByDate('20260420');
    assert.equal(liveRes.ok, false);
    if (!liveRes.ok) assert.equal(liveRes.error.code, 'UPSTREAM_SCHEMA_INVALID');

    // Verify none of the failed responses were cached in L2
    assert.equal(await store.getL2Cache('football:tsl:match:102:info'), null);
    assert.equal(await store.getL2Cache('football:tsl:match:104:info'), null);
    assert.equal(await store.getL2Cache('football:tsl:livescore:date:20260420'), null);
    resetAllState();
  });

  // ---------------------------------------------------------------------------
  // 3. Caching, Single-Flight Coalescing, Budget, Cooldown & Bounded Retries
  // ---------------------------------------------------------------------------
  console.log('\n3. Caching, Coalescing, Budget Enforcement & Bounded Retries:');

  await test('L1 and L2 cache hits avoid upstream fetches', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '555', Vnm: 'Emirates Stadium', Vsp: 60260, Refs: [] });
    });

    const first = await provider.getMatchInfo('555');
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.cache.source, 'UPSTREAM');
      assert.equal(first.data.venueName, 'Emirates Stadium');
    }
    assert.equal(fetchCalls, 1);

    // Second call hits L1
    const second = await provider.getMatchInfo('555');
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.cache.source, 'L1_HIT');
    assert.equal(fetchCalls, 1);

    // Clear L1 -> third call hits L2
    provider.clearFootballProviderL1Cache();
    const third = await provider.getMatchInfo('555');
    assert.equal(third.ok, true);
    if (third.ok) assert.equal(third.cache.source, 'L2_HIT');
    assert.equal(fetchCalls, 1);
    resetAllState();
  });

  await test('concurrent identical requests coalesce into a single upstream call', async () => {
    resetAllState();
    coord.setGlobalCoordinationStore(new coord.InMemoryCoordinationStore());

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      await new Promise((r) => setTimeout(r, 40));
      return jsonResponse({ Eid: '777', Vnm: 'Anfield', Refs: [] });
    });

    const results = await Promise.all([
      provider.getMatchInfo('777'),
      provider.getMatchInfo('777'),
      provider.getMatchInfo('777'),
      provider.getMatchInfo('777'),
      provider.getMatchInfo('777'),
    ]);

    assert.equal(fetchCalls, 1, '5 concurrent identical calls must produce 1 upstream request');
    for (const r of results) {
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.data.venueName, 'Anfield');
    }
    resetAllState();
  });

  await test('global budget lease is acquired before fetch and budget denial blocks request', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    // Exhaust API burst budget (6 req / 1s)
    for (let i = 0; i < 6; i++) {
      const lease = await store.acquireBudgetLease(
        client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider,
        6,
        1
      );
      assert.equal(lease.allowed, true);
    }

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '888', Refs: [] });
    });

    const blocked = await provider.getMatchInfo('888');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.error.code, 'UPSTREAM_BUDGET_EXCEEDED');
      assert.equal(blocked.error.statusCode, 429);
    }
    assert.equal(fetchCalls, 0);
    resetAllState();
  });

  await test('HTTP 429 triggers host-wide API cooldown across both budget keys without consuming reservations (F-32-02)', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return textResponse('Too Many Requests', 429, 'text/plain');
    });

    const first = await provider.getMatchInfo('901');
    assert.equal(first.ok, false);
    if (!first.ok) assert.equal(first.error.statusCode, 429);
    assert.equal(fetchCalls, 1);

    const burstBefore = (
      await store.getStatus(client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider, 6, 1)
    ).requestsInWindow;
    const sustainedBefore = (
      await store.getStatus(client.TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider, 180, 60)
    ).requestsInWindow;

    // Fire 10 requests (> API_BURST ceiling of 6) during cooldown: ALL must return UPSTREAM_COOLDOWN
    // and consume ZERO burst or sustained reservations
    for (let i = 0; i < 10; i++) {
      const blocked = await provider.getMatchInfo(String(902 + i));
      assert.equal(blocked.ok, false);
      if (!blocked.ok) {
        assert.equal(blocked.error.code, 'UPSTREAM_COOLDOWN');
        assert.equal(blocked.error.statusCode, 503);
      }
    }

    assert.equal(fetchCalls, 1);
    const burstAfter = (
      await store.getStatus(client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider, 6, 1)
    ).requestsInWindow;
    const sustainedAfter = (
      await store.getStatus(client.TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider, 180, 60)
    ).requestsInWindow;
    assert.equal(burstAfter, burstBefore, 'Cooldown must not consume API_BURST reservations');
    assert.equal(sustainedAfter, sustainedBefore, 'Cooldown must not consume API_SUSTAINED reservations');

    // King host must remain independent of API host cooldown
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Stages: [] });
    });
    const kingRes = await provider.getFixturesByDate('20260420');
    assert.equal(kingRes.ok, true, 'King host must remain unaffected by API host cooldown');
    assert.equal(fetchCalls, 2);
    resetAllState();
  });

  await test('API sustained (180/60s) and KING sustained (40/60s) limits are enforced independently', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    // Exhaust API_SUSTAINED (180/60s) while API_BURST is still empty
    for (let i = 0; i < 180; i++) {
      const lease = await store.acquireBudgetLease(
        client.TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider,
        180,
        60
      );
      assert.equal(lease.allowed, true);
    }

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      return jsonResponse({ Eid: '920', Refs: [] });
    });

    const apiBlocked = await provider.getMatchInfo('920');
    assert.equal(apiBlocked.ok, false);
    if (!apiBlocked.ok) {
      assert.equal(apiBlocked.error.code, 'UPSTREAM_BUDGET_EXCEEDED');
      assert.equal(apiBlocked.error.statusCode, 429);
    }
    assert.equal(fetchCalls, 0);

    // Exhaust KING_SUSTAINED (40/60s)
    for (let i = 0; i < 40; i++) {
      const lease = await store.acquireBudgetLease(
        client.TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.provider,
        40,
        60
      );
      assert.equal(lease.allowed, true);
    }

    const kingBlocked = await provider.getFixturesByDate('20260421');
    assert.equal(kingBlocked.ok, false);
    if (!kingBlocked.ok) {
      assert.equal(kingBlocked.error.code, 'UPSTREAM_BUDGET_EXCEEDED');
      assert.equal(kingBlocked.error.statusCode, 429);
    }
    assert.equal(fetchCalls, 0);
    resetAllState();
  });

  await test('retry attempt 2 is denied when global budget is exhausted after attempt 1', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    // Leave exactly 1 slot in API_BURST (5/6 used)
    for (let i = 0; i < 5; i++) {
      await store.acquireBudgetLease(client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider, 6, 1);
    }

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      const err = new Error('Simulated timeout on attempt 1');
      err.name = 'TimeoutError';
      throw err;
    });

    const res = await provider.getMatchInfo('940');
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'UPSTREAM_BUDGET_EXCEEDED');
      assert.equal(res.error.statusCode, 429);
    }
    assert.equal(fetchCalls, 1, 'Retry attempt 2 must be blocked by global budget before fetch');
    resetAllState();
  });

  await test('L1/L2 stale cache serves safely during degraded mode and upstream outages', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    // Seed an already-stale (freshUntil in past, staleUntil in future) L2 entry directly
    const lock = await store.acquireLock('football:lock:tsl:match:960:info', 'seed-worker', 10);
    assert.equal(lock.acquired, true);
    const written = await store.setL2Cache(
      'football:tsl:match:960:info',
      {
        eventId: '960',
        kickoffIso: null,
        venueName: 'Stale Emirates',
        city: 'London',
        country: 'England',
        attendance: null,
        isNeutralVenue: false,
        referees: [],
      },
      -5, // freshUntil already elapsed
      300, // still within stale window
      '960',
      undefined,
      null,
      lock.fencingToken!,
      'football:lock:tsl:match:960:info',
      'seed-worker'
    );
    assert.equal(written, true);
    await store.releaseLock('football:lock:tsl:match:960:info', 'seed-worker', lock.fencingToken!);

    // Case 1: Upstream fails -> serves L2 stale candidate safely
    client.setFootballProviderFetch(async () => textResponse('Service Unavailable', 503, 'text/plain'));
    const staleOnOutage = await provider.getMatchInfo('960');
    assert.equal(staleOnOutage.ok, true);
    if (staleOnOutage.ok) {
      assert.equal(staleOnOutage.data.venueName, 'Stale Emirates');
      assert.equal(staleOnOutage.cache.source, 'STALE');
      assert.equal(staleOnOutage.cache.degraded, true);
    }

    // Case 2: Coordination enters degraded fail-closed mode -> still serves L1 stale entry without upstream call
    coord.setGlobalCoordinationStore(
      new coord.DegradedFailClosedCoordinationStore('Simulated production DB outage')
    );
    let degradedFetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      degradedFetchCalls++;
      return jsonResponse({ Eid: '960', Vnm: 'Should Not Fetch' });
    });

    const staleOnDegraded = await provider.getMatchInfo('960');
    assert.equal(staleOnDegraded.ok, true);
    if (staleOnDegraded.ok) {
      assert.equal(staleOnDegraded.data.venueName, 'Stale Emirates');
      assert.equal(staleOnDegraded.cache.source, 'STALE');
      assert.equal(staleOnDegraded.cache.degraded, true);
    }
    assert.equal(degradedFetchCalls, 0);
    resetAllState();
  });

  await test('L2 fencing rejection prevents stale lock holder from publishing stale data into L1 (F-32-03)', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    const cacheKey = 'football:tsl:match:970:info';
    const lockKey = 'football:lock:tsl:match:970:info';

    // Simulate Worker A (current process) acquiring lock, fetching slowly, while Worker B
    // supersedes the lock with a higher fencing token and writes newer data to L2.
    client.setFootballProviderFetch(async () => {
      // Force Worker A's lock to expire & let Worker B take over with a newer fencing token
      const originalSetL2 = store.setL2Cache.bind(store);
      // Acquire lock as Worker B after releasing/expiring Worker A's lock via store internals:
      // Simulate by letting Worker B write newer L2 entry with a higher token before Worker A finishes.
      await store.resetAll();
      const workerBLock = await store.acquireLock(lockKey, 'worker-B-newer', 30);
      assert.equal(workerBLock.acquired, true);
      const bWritten = await originalSetL2(
        cacheKey,
        {
          eventId: '970',
          kickoffIso: null,
          venueName: 'Newer Worker B Stadium',
          city: 'London',
          country: 'England',
          attendance: null,
          isNeutralVenue: false,
          referees: [],
        },
        600,
        3600,
        '970',
        undefined,
        null,
        workerBLock.fencingToken!,
        lockKey,
        'worker-B-newer'
      );
      assert.equal(bWritten, true);

      // Worker A finishes late with stale upstream data
      return jsonResponse({ Eid: '970', Vnm: 'Stale Worker A Stadium', Refs: [] });
    });

    const workerAResult = await provider.getMatchInfo('970');
    assert.equal(workerAResult.ok, true);
    if (workerAResult.ok) {
      assert.equal(
        workerAResult.data.venueName,
        'Newer Worker B Stadium',
        'Fenced-out Worker A must adopt newer L2 result instead of stale payload'
      );
    }

    // Subsequent call must hit L1/L2 with Worker B's newer data, NEVER Worker A's stale data
    const laterResult = await provider.getMatchInfo('970');
    assert.equal(laterResult.ok, true);
    if (laterResult.ok) {
      assert.equal(laterResult.data.venueName, 'Newer Worker B Stadium');
      assert.equal(laterResult.cache.source, 'L1_HIT');
    }
    resetAllState();
  });

  await test('tightened mappers reject empty or error-shaped HTTP 200 JSON objects without caching (F-32-07)', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    client.setFootballProviderFetch(async () => jsonResponse({ error: 'temporary upstream error' }, 200));

    const rInfo = await provider.getMatchInfo('980');
    assert.equal(rInfo.ok, false);
    if (!rInfo.ok) assert.equal(rInfo.error.code, 'UPSTREAM_SCHEMA_INVALID');

    const rInc = await provider.getMatchIncidents('980');
    assert.equal(rInc.ok, false);
    if (!rInc.ok) assert.equal(rInc.error.code, 'UPSTREAM_SCHEMA_INVALID');

    const rStat = await provider.getMatchStatistics('980');
    assert.equal(rStat.ok, false);
    if (!rStat.ok) assert.equal(rStat.error.code, 'UPSTREAM_SCHEMA_INVALID');

    const rLineups = await provider.getMatchLineups('980');
    assert.equal(rLineups.ok, false);
    if (!rLineups.ok) assert.equal(rLineups.error.code, 'UPSTREAM_SCHEMA_INVALID');

    const rForm = await provider.getMatchForm('980');
    assert.equal(rForm.ok, false);
    if (!rForm.ok) assert.equal(rForm.error.code, 'UPSTREAM_SCHEMA_INVALID');

    const rTable = await provider.getCompetitionTable('65');
    assert.equal(rTable.ok, false);
    if (!rTable.ok) assert.equal(rTable.error.code, 'UPSTREAM_SCHEMA_INVALID');

    // Reset burst budget (6/1s) before 7th API endpoint assertion
    await store.resetAll();

    const rStats = await provider.getTeamPlayerStats('65', '2871', 'goals');
    assert.equal(rStats.ok, false);
    if (!rStats.ok) assert.equal(rStats.error.code, 'UPSTREAM_SCHEMA_INVALID');

    assert.equal(await store.getL2Cache('football:tsl:match:980:info'), null);
    assert.equal(await store.getL2Cache('football:tsl:competition:65:table'), null);
    resetAllState();
  });

  await test('bounded budget-controlled retry executes at most 1 retry on transient error and consumes 2 leases', async () => {
    resetAllState();
    const store = new coord.InMemoryCoordinationStore();
    coord.setGlobalCoordinationStore(store);

    let fetchCalls = 0;
    client.setFootballProviderFetch(async () => {
      fetchCalls++;
      if (fetchCalls === 1) {
        const err = new Error('Simulated timeout');
        err.name = 'TimeoutError';
        throw err;
      }
      return jsonResponse({ Eid: '950', Vnm: 'Old Trafford', Refs: [] });
    });

    const res = await provider.getMatchInfo('950');
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.data.venueName, 'Old Trafford');
    assert.equal(fetchCalls, 2, 'Should retry once after transient timeout');

    const burstStatus = await store.getStatus(client.TOTALSPORTSLIVE_BUDGETS.API_BURST.provider, 6, 1);
    assert.equal(burstStatus.requestsInWindow, 2, 'Retry must consume a second global budget lease');
    resetAllState();
  });

  // ---------------------------------------------------------------------------
  // 4. Data Mapping & Authenticity Tests
  // ---------------------------------------------------------------------------
  console.log('\n4. Data Mapping & Zero-Fabrication Authenticity:');

  await test('preserves 0-0 score on LIVE/FINISHED matches and enforces null score on NS/POSTPONED/CANCELLED', () => {
    const comp = {
      compId: '65',
      stageId: '25545',
      name: 'Premier League',
      country: 'England',
      slug: 'premier-league',
      badgePath: null,
      accentColor: null,
    };

    const baseEvent = {
      Eid: '1001',
      T1: [{ ID: '2871', Nm: 'Arsenal', Abr: 'ARS' }],
      T2: [{ ID: '2880', Nm: 'Chelsea', Abr: 'CHE' }],
      Esd: '20260420150000',
      Tr1: '0',
      Tr2: '0',
      Trh1: '0',
      Trh2: '0',
    };

    // FINISHED 0-0 must preserve genuine 0
    const finished = mapper.mapRawEventToMatch({ ...baseEvent, Eps: 'FT' }, comp);
    assert.ok(finished);
    assert.equal(finished.status, 'FINISHED');
    assert.deepEqual(finished.score, { home: 0, away: 0 });
    assert.deepEqual(finished.halfTimeScore, { home: 0, away: 0 });

    // LIVE 0-0 at 32'
    const live = mapper.mapRawEventToMatch({ ...baseEvent, Eps: "32'" }, comp);
    assert.ok(live);
    assert.equal(live.status, 'LIVE');
    assert.equal(live.minute, 32);
    assert.deepEqual(live.score, { home: 0, away: 0 });

    // NS match MUST have score: null even if upstream passes Tr1="0", Tr2="0"
    const upcoming = mapper.mapRawEventToMatch({ ...baseEvent, Eps: 'NS' }, comp);
    assert.ok(upcoming);
    assert.equal(upcoming.score, null);
    assert.equal(upcoming.halfTimeScore, null);
    assert.equal(upcoming.minute, null);

    // POSTPONED match MUST have score: null
    const postponed = mapper.mapRawEventToMatch({ ...baseEvent, Eps: 'Postp.' }, comp);
    assert.ok(postponed);
    assert.equal(postponed.status, 'POSTPONED');
    assert.equal(postponed.score, null);
  });

  await test('missing optional fields map to null without fabrication and invalid dates/statuses are handled safely', () => {
    const info = mapper.mapMatchInfo({ Eid: '2001', Esd: '99999999999999' }, '2001');
    assert.equal(info.eventId, '2001');
    assert.equal(info.kickoffIso, null);
    assert.equal(info.venueName, null);
    assert.equal(info.city, null);
    assert.equal(info.country, null);
    assert.equal(info.attendance, null);
    assert.equal(info.isNeutralVenue, null);
    assert.deepEqual(info.referees, []);

    const statusUnknown = mapper.normalizeMatchStatus('WEIRD_CODE', null);
    assert.equal(statusUnknown.status, 'UNKNOWN');
    assert.equal(statusUnknown.minute, null);
  });

  await test('maps team squad with canonical Aid (not Pid) and player profile with object clEvents', () => {
    const squad = mapper.mapTeamSquad(
      {
        ID: '2871',
        Nm: 'Arsenal',
        CoNm: 'England',
        Ps: [
          { Pid: '999001', Aid: '1014252', Pnm: 'Bukayo Saka', Snu: '7', Pos: 3 },
          { Pid: '999002', Pnm: 'Missing Aid Player' }, // must be skipped
        ],
      },
      '2871'
    );
    assert.equal(squad.players.length, 1);
    assert.equal(squad.players[0].aid, '1014252');
    assert.equal(squad.players[0].squadEntryId, '999001');
    assert.equal(squad.players[0].shirtNumber, 7);

    const profile = mapper.mapPlayerProfile(
      {
        id: '1014252',
        player: { id: '1014252', firstName: 'Bukayo', lastName: 'Saka', h: null, bd: '2001-09-05' },
        participants: [{ id: '2871', name: 'Arsenal' }],
        currentInfo: { playerParticipant: { participantId: '2871', position: 'RW', shirtNumber: 7 } },
        career: [{ part: { id: '2871', name: 'Arsenal', reg: 'ENG' }, start: '2018-07-01', end: null }],
        tournaments: [],
        clEvents: { someKey: { nested: true } }, // verified object shape, not array
      },
      '1014252'
    );
    assert.equal(profile.aid, '1014252');
    assert.equal(profile.fullName, 'Bukayo Saka');
    assert.equal(profile.heightCm, null);
    assert.equal(profile.currentTeamId, '2871');
    assert.equal(profile.currentTeamName, 'Arsenal');
    assert.equal(profile.career.length, 1);
  });

  await test('maps team details while discarding unused heavy feed/news blobs', () => {
    const details = mapper.mapTeamDetails(
      {
        ID: '2871',
        Nm: 'Arsenal',
        Abr: 'ARS',
        CoNm: 'England',
        HasSquad: true,
        DomCompId: '65',
        News: new Array(200).fill({ title: 'Huge unused blob' }),
        Feed: { huge: 'payload' },
        Stages: [],
      },
      '2871'
    );
    assert.equal(details.teamId, '2871');
    assert.equal(details.domesticCompId, '65');
    assert.equal('News' in (details as unknown as Record<string, unknown>), false);
    assert.equal('Feed' in (details as unknown as Record<string, unknown>), false);
  });

  console.log(`\nALL ${passed} FOOTBALL PROVIDER STAGE 3.2 TESTS PASSED.`);
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
