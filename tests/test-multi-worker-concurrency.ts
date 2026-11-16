/**
 * ZimKickOff Developer API — Phase 2.19
 * Multi-Worker Concurrency & Traffic Protection Test Suite
 *
 * Verifies horizontal coordination, global rate limiting, shared cooldown,
 * cross-worker single flight, and L1/L2 cache isolation across independent
 * OS child processes (forked via child_process.fork()).
 */

// Stub server-only before any other imports
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import { Client } from 'pg';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err?.message || err}`);
    if (err?.stack) {
      console.error(err.stack);
    }
    failed++;
  }
}

/**
 * Worker Process Wrapper
 */
class ChildWorkerHandle {
  public child: ChildProcess;
  public pid: number;
  private reqId = 0;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(child: ChildProcess) {
    this.child = child;
    this.pid = child.pid || 0;

    this.child.on('message', (msg: any) => {
      if (msg.event === 'online') return;
      const { id, result, error } = msg;
      const handler = this.pending.get(id);
      if (handler) {
        this.pending.delete(id);
        if (error) {
          handler.reject(new Error(error));
        } else {
          handler.resolve(result);
        }
      }
    });
  }

  send(command: string, payload: any = {}): Promise<any> {
    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.send({ id, command, payload });
    });
  }

  kill(): void {
    try {
      this.child.kill('SIGTERM');
    } catch {}
  }
}

function spawnWorker(): ChildWorkerHandle {
  const childScript = path.join(__dirname, 'worker-child.ts');
  const child = fork(childScript, [], {
    execArgv: process.execArgv,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  return new ChildWorkerHandle(child);
}

async function main() {
  console.log('================================================================================');
  console.log('--- Running ZimKickOff Phase 2.19 Multi-Worker Concurrency Test Suite ---');
  console.log('================================================================================\n');

  // Dynamic imports after server-only is stubbed
  const { InMemoryCoordinationStore } = await import('../lib/api/upstream-coordination');
  const { extractSignedUrlExpiryMs, isSignedUrlExpired } = await import('../lib/api/vnres-catalog');

  /**
   * Coordination Broker Server
   * Runs in the test orchestrator and exposes an HTTP interface to the shared
   * coordination store so multiple isolated child processes can coordinate state.
   */
  class CoordinationBrokerServer {
    private server: http.Server | null = null;
    public store = new InMemoryCoordinationStore();
    public port = 0;
    public url = '';

    async start(): Promise<void> {
      return new Promise((resolve) => {
        this.server = http.createServer(async (req, res) => {
          const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            let parsed: any = {};
            if (body) {
              try { parsed = JSON.parse(body); } catch {}
            }

            res.setHeader('Content-Type', 'application/json');

            try {
              switch (url.pathname) {
                case '/budget/acquire': {
                  const result = await this.store.acquireBudgetLease(
                    parsed.provider,
                    parsed.maxRequests,
                    parsed.windowSeconds
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify(result));
                  break;
                }
                case '/budget/status': {
                  const result = await this.store.getStatus(
                    parsed.provider,
                    parsed.maxRequests,
                    parsed.windowSeconds
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify(result));
                  break;
                }
                case '/cooldown/set': {
                  const result = await this.store.setCooldown(
                    parsed.provider,
                    parsed.cooldownSeconds,
                    parsed.reason
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify(result));
                  break;
                }
                case '/cooldown/success': {
                  await this.store.recordSuccess(parsed.provider);
                  res.writeHead(200);
                  res.end(JSON.stringify({ success: true }));
                  break;
                }
                case '/lock/acquire': {
                  const lockRes = await this.store.acquireLock(
                    parsed.lockKey,
                    parsed.ownerId,
                    parsed.ttlSeconds
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify({ acquired: lockRes.acquired, fencingToken: lockRes.fencingToken }));
                  break;
                }
                case '/lock/release': {
                  const released = await this.store.releaseLock(
                    parsed.lockKey,
                    parsed.ownerId,
                    parsed.fencingToken
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify({ released }));
                  break;
                }
                case '/cache/get': {
                  const key = url.searchParams.get('key') || '';
                  const result = await this.store.getL2Cache(key);
                  res.writeHead(200);
                  res.end(JSON.stringify(result));
                  break;
                }
                case '/cache/set': {
                  const success = await this.store.setL2Cache(
                    parsed.cacheKey,
                    parsed.payload,
                    parsed.freshSeconds,
                    parsed.staleSeconds,
                    parsed.matchId,
                    parsed.fixtureKey,
                    parsed.minTokenExpiryMs,
                    parsed.fencingToken,
                    parsed.lockKey,
                    parsed.ownerId
                  );
                  res.writeHead(200);
                  res.end(JSON.stringify({ success }));
                  break;
                }
                case '/cache/clear': {
                  await this.store.clearL2Cache(parsed.cacheKey);
                  res.writeHead(200);
                  res.end(JSON.stringify({ success: true }));
                  break;
                }
                case '/reset': {
                  await this.store.resetAll(parsed.provider);
                  res.writeHead(200);
                  res.end(JSON.stringify({ success: true }));
                  break;
                }
                case '/cleanup': {
                  const result = await this.store.cleanupExpired();
                  res.writeHead(200);
                  res.end(JSON.stringify(result));
                  break;
                }
                default:
                  res.writeHead(404);
                  res.end(JSON.stringify({ error: 'Not found' }));
              }
            } catch (e: any) {
              res.writeHead(500);
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });

        this.server.listen(0, '127.0.0.1', () => {
          const addr = this.server!.address() as any;
          this.port = addr.port;
          this.url = `http://127.0.0.1:${this.port}`;
          resolve();
        });
      });
    }

    async stop(): Promise<void> {
      if (this.server) {
        return new Promise((resolve) => {
          this.server!.close(() => resolve());
        });
      }
    }
  }

  // 0. Check Database Prerequisites
  console.log('--- 0. PostgreSQL Database Prerequisite & Migration Status Check ---');
  const dbClient = new Client({
    host: '127.0.0.1',
    port: 54321,
    user: 'postgres',
    password: 'postgres',
    database: 'zimkickoff_test',
  });

  let dbConnected = false;
  let phase219TablesExist = false;

  try {
    await dbClient.connect();
    dbConnected = true;
    const res = await dbClient.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'api_upstream_budget_reservations';
    `);
    phase219TablesExist = (res.rowCount || 0) > 0;
  } catch {
    // Database connection or table check failed
  } finally {
    if (dbConnected) {
      await dbClient.end().catch(() => {});
    }
  }

  if (phase219TablesExist) {
    console.log('✓ PostgreSQL test database has Phase 2.19 migration tables installed.');
  } else {
    console.log(
      'ℹ [PostgreSQL Integration Check]: Stored procedure public.acquire_upstream_budget_lease is not present in local test DB (migration 20261114000000_upstream_coordination_and_l2_cache.sql unexecuted).'
    );
    console.log(
      'ℹ Per Phase 2.19 strict authorization rules: SQL migrations MUST NOT be executed. Reporting DB execution as blocked by unexecuted migration.\n'
    );
  }

  // Start Coordination Broker
  const broker = new CoordinationBrokerServer();
  await broker.start();

  // Spawn three independent OS worker processes
  let worker1 = spawnWorker();
  let worker2 = spawnWorker();
  let worker3 = spawnWorker();

  await worker1.send('init', { brokerUrl: broker.url });
  await worker2.send('init', { brokerUrl: broker.url });
  await worker3.send('init', { brokerUrl: broker.url });

  console.log(`Initialized Worker 1 (PID ${worker1.pid}), Worker 2 (PID ${worker2.pid}), and Worker 3 (PID ${worker3.pid})\n`);

  // ---------------------------------------------------------------------------
  // Test 1: Two independent workers competing for the same upstream budget
  // ---------------------------------------------------------------------------
  await test('1. Two independent workers competing for the same upstream budget', async () => {
    await broker.store.resetAll('vnres');

    // Worker 1 acquires 30 slots
    for (let i = 0; i < 30; i++) {
      const res = await worker1.send('reserve_budget', { provider: 'vnres' });
      assert.equal(res.allowed, true);
    }

    // Worker 2 acquires 30 slots
    for (let i = 0; i < 30; i++) {
      const res = await worker2.send('reserve_budget', { provider: 'vnres' });
      assert.equal(res.allowed, true);
    }

    // Check combined status
    const status = await worker1.send('get_status', { provider: 'vnres' });
    assert.equal(status.requestsInWindow, 60, 'Combined budget reservations across workers must be 60');
  });

  // ---------------------------------------------------------------------------
  // Test 2: Global 120-per-minute enforcement across workers
  // ---------------------------------------------------------------------------
  await test('2. Global 120-per-minute enforcement', async () => {
    await broker.store.resetAll('vnres');

    // Worker 1 acquires 70 slots
    for (let i = 0; i < 70; i++) {
      const res = await worker1.send('reserve_budget', { provider: 'vnres' });
      assert.equal(res.allowed, true);
    }

    // Worker 2 acquires 50 slots (total = 120)
    for (let i = 0; i < 50; i++) {
      const res = await worker2.send('reserve_budget', { provider: 'vnres' });
      assert.equal(res.allowed, true);
    }

    const statusAt120 = await worker2.send('get_status', { provider: 'vnres' });
    assert.equal(statusAt120.requestsInWindow, 120);

    // 121st request from Worker 1 must be REJECTED
    const res1 = await worker1.send('reserve_budget', { provider: 'vnres' });
    assert.equal(res1.allowed, false);
    assert.equal(res1.reason, 'BUDGET_EXCEEDED');
    assert.ok(res1.retryAfter > 0);

    // 122nd request from Worker 2 must ALSO be REJECTED
    const res2 = await worker2.send('reserve_budget', { provider: 'vnres' });
    assert.equal(res2.allowed, false);
    assert.equal(res2.reason, 'BUDGET_EXCEEDED');
    assert.ok(res2.retryAfter > 0);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Concurrent reservations at the budget boundary
  // ---------------------------------------------------------------------------
  await test('3. Concurrent reservations at the budget boundary', async () => {
    await broker.store.resetAll('vnres');

    // Pre-fill to 119 slots
    for (let i = 0; i < 119; i++) {
      await worker1.send('reserve_budget', { provider: 'vnres' });
    }

    // Both workers race for the 120th slot simultaneously
    const [race1, race2] = await Promise.all([
      worker1.send('reserve_budget', { provider: 'vnres' }),
      worker2.send('reserve_budget', { provider: 'vnres' }),
    ]);

    const allowedCount = (race1.allowed ? 1 : 0) + (race2.allowed ? 1 : 0);
    const rejectedCount = (!race1.allowed ? 1 : 0) + (!race2.allowed ? 1 : 0);

    assert.equal(allowedCount, 1, 'Exactly one concurrent request must be granted slot #120');
    assert.equal(rejectedCount, 1, 'The competing concurrent request must be rejected');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Shared cooldown propagation
  // ---------------------------------------------------------------------------
  await test('4. Shared cooldown propagation', async () => {
    await broker.store.resetAll('vnres');

    // Worker 1 encounters upstream 500 error and sets a 30s failure cooldown
    const cdRes = await worker1.send('set_cooldown', { provider: 'vnres', seconds: 30, reason: 'HTTP 500' });
    assert.ok(cdRes.cooldownUntilMs > Date.now());

    // Worker 2 checks status and attempts a budget lease
    const status2 = await worker2.send('get_status', { provider: 'vnres' });
    assert.equal(status2.inCooldown, true, 'Worker 2 must see active cooldown initiated by Worker 1');
    assert.ok(status2.cooldownRemainingSeconds > 0);

    const lease2 = await worker2.send('reserve_budget', { provider: 'vnres' });
    assert.equal(lease2.allowed, false, 'Worker 2 must be rejected before calling upstream');
    assert.equal(lease2.reason, 'COOLDOWN');
    assert.ok(lease2.retryAfter > 0);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Cooldown persistence across simulated worker restarts
  // ---------------------------------------------------------------------------
  await test('5. Cooldown persistence across simulated worker restarts', async () => {
    await broker.store.resetAll('vnres');

    // Worker 1 triggers 30s cooldown
    await worker1.send('set_cooldown', { provider: 'vnres', seconds: 30, reason: 'Worker 1 crash precursor' });

    // Simulate Worker 1 crashing and being restarted by PM2
    worker1.kill();
    worker1 = spawnWorker();
    await worker1.send('init', { brokerUrl: broker.url });

    // The newly spawned Worker 1 process inspects cooldown state
    const restartedStatus = await worker1.send('get_status', { provider: 'vnres' });
    assert.equal(restartedStatus.inCooldown, true, 'Cooldown must persist across PM2 worker restarts');
    assert.ok(restartedStatus.cooldownRemainingSeconds > 0);

    const restartedLease = await worker1.send('reserve_budget', { provider: 'vnres' });
    assert.equal(restartedLease.allowed, false, 'Restarted worker must respect active cooldown');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Cross-worker single-flight for identical fixture requests
  // ---------------------------------------------------------------------------
  await test('6. Cross-worker single-flight for identical fixture requests', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_arsenal_vs_chelsea';
    const l2CacheKey = 'vnres_cat_arsenal_vs_chelsea';
    const mockFixtureData = { matchId: '1738342', streams: [{ id: 's1', url: 'https://pull.niur.live/feed.m3u8' }] };

    // Worker 1 and Worker 2 fire simultaneous requests for the same fixture.
    // Worker 1's upstream fetch is configured with a 300ms artificial delay.
    const [fetch1, fetch2] = await Promise.all([
      worker1.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 300, mockData: mockFixtureData }),
      worker2.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 300, mockData: mockFixtureData }),
    ]);

    // Both workers must return the correct fixture data
    assert.equal(fetch1.data.matchId, '1738342');
    assert.equal(fetch2.data.matchId, '1738342');

    // Exactly one worker must have executed the upstream fetch
    const upstreamCalls = (fetch1.upstreamCalled ? 1 : 0) + (fetch2.upstreamCalled ? 1 : 0);
    assert.equal(upstreamCalls, 1, 'Only one upstream request must be executed across workers (single-flight)');
  });

  // ---------------------------------------------------------------------------
  // Test 7: Independent fixture requests proceeding concurrently
  // ---------------------------------------------------------------------------
  await test('7. Independent fixture requests proceeding concurrently', async () => {
    await broker.store.resetAll('vnres');

    const lockKeyA = 'vnres_lock_real_madrid_vs_barcelona';
    const lockKeyB = 'vnres_lock_bayern_vs_dortmund';

    // Worker 1 queries match A, Worker 2 queries match B concurrently
    const [fetchA, fetchB] = await Promise.all([
      worker1.send('single_flight_fetch', {
        lockKey: lockKeyA,
        l2CacheKey: 'vnres_cat_match_a',
        delayMs: 100,
        mockData: { matchId: '1001', name: 'El Clasico' },
      }),
      worker2.send('single_flight_fetch', {
        lockKey: lockKeyB,
        l2CacheKey: 'vnres_cat_match_b',
        delayMs: 100,
        mockData: { matchId: '1002', name: 'Der Klassiker' },
      }),
    ]);

    assert.equal(fetchA.data.name, 'El Clasico');
    assert.equal(fetchB.data.name, 'Der Klassiker');
    assert.equal(fetchA.upstreamCalled, true);
    assert.equal(fetchB.upstreamCalled, true);
  });

  // ---------------------------------------------------------------------------
  // Test 8: L2 cache visibility across workers
  // ---------------------------------------------------------------------------
  await test('8. L2 cache visibility across workers', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'streams_lock_1913895';
    const ownerId = `owner_${worker1.pid}_8`;

    // Leader acquires lock, then writes to L2 with ownership proof
    const acq = await worker1.send('acquire_lock', { lockKey, ownerId, ttlSeconds: 10 });
    assert.equal(acq.acquired, true);

    const write = await worker1.send('write_l2_cache', {
      key: 'streams_1913895',
      data: { matchId: '1913895', streams: [{ id: 's2', url: 'https://pull.niur.live/hd.m3u8' }] },
      freshSeconds: 30,
      staleSeconds: 60,
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId,
    });
    assert.equal(write.success, true);

    // Worker 2 reads from L2 cache directly
    const cachedL2 = await worker2.send('read_l2_cache', { key: 'streams_1913895' });
    assert.ok(cachedL2 !== null);
    assert.equal(cachedL2.payload.matchId, '1913895');
    assert.equal(cachedL2.isFresh, true);

    await worker1.send('release_lock', { lockKey, ownerId, fencingToken: acq.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test 9: L1 cache isolation without correctness failures (AUDIT-28-01)
  // ---------------------------------------------------------------------------
  await test('9. L1 cache isolation without correctness failures', async () => {
    await broker.store.resetAll('vnres');

    // Worker 1 executes SWR fetch -> populates Worker 1's L1 memory
    const swr1 = await worker1.send('swr_fetch', {
      key: 'swr_isolation_test',
      data: { score: '1-0' },
      config: { freshTtlSeconds: 10, staleWindowSeconds: 30 },
    });
    assert.equal(swr1.fetchCount, 1);
    assert.equal(swr1.res.source, 'MISS');

    // General SWR is process-local in L1 (AUDIT-28-01: unfenced SWR does not write to L2 catalog cache).
    // Worker 2 queries same key -> misses its own L1, executes fetch safely without crashing or corrupting L2.
    const swr2 = await worker2.send('swr_fetch', {
      key: 'swr_isolation_test',
      data: { score: '1-0' },
      config: { freshTtlSeconds: 10, staleWindowSeconds: 30 },
    });
    assert.equal(swr2.fetchCount, 1, 'Worker 2 invokes independent SWR fetch for process-local L1');
    assert.equal(swr2.res.source, 'MISS');
    assert.equal(swr2.res.data.score, '1-0');

    // Subsequent call within Worker 2 hits Worker 2's L1 without fetching
    const swr2Hit = await worker2.send('swr_fetch', {
      key: 'swr_isolation_test',
      data: { score: '1-0' },
      config: { freshTtlSeconds: 10, staleWindowSeconds: 30 },
    });
    assert.equal(swr2Hit.fetchCount, 0, 'Worker 2 hits its local L1 cache on second request (0 fetches)');
    assert.equal(swr2Hit.res.source, 'HIT');
  });

  // ---------------------------------------------------------------------------
  // Test 10: Cache expiry and invalidation
  // ---------------------------------------------------------------------------
  await test('10. Cache expiry and invalidation', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'test_invalidate_lock';
    const ownerId = `owner_${worker1.pid}_10`;

    // Worker 1 acquires lock and writes entry to L2
    const acq = await worker1.send('acquire_lock', { lockKey, ownerId, ttlSeconds: 10 });
    assert.equal(acq.acquired, true);

    const write = await worker1.send('write_l2_cache', {
      key: 'test_invalidate_key',
      data: { value: 'initial' },
      freshSeconds: 15,
      staleSeconds: 60,
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId,
    });
    assert.equal(write.success, true);

    // Verify Worker 2 can read it
    const beforeInvalidate = await worker2.send('read_l2_cache', { key: 'test_invalidate_key' });
    assert.equal(beforeInvalidate?.payload?.value, 'initial');

    // Worker 1 invalidates the key
    await worker1.send('invalidate_cache', { key: 'test_invalidate_key' });

    // Worker 2 must now see null in L2
    const afterInvalidate = await worker2.send('read_l2_cache', { key: 'test_invalidate_key' });
    assert.equal(afterInvalidate, null, 'Key must be purged from L2 cache upon invalidation');

    await worker1.send('release_lock', { lockKey, ownerId, fencingToken: acq.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test 11: Expired signed URLs never being served
  // ---------------------------------------------------------------------------
  await test('11. Expired signed URLs never being served', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. txTime: Tencent hexadecimal epoch seconds
    const expiredTxHex = (nowSec - 60).toString(16);
    const validTxHex = (nowSec + 3600).toString(16);

    const expiredTxUrl = `https://pull.niur.live/live/feed.m3u8?txSecret=abc&txTime=${expiredTxHex}`;
    const validTxUrl = `https://pull.niur.live/live/feed.m3u8?txSecret=abc&txTime=${validTxHex}`;

    assert.equal(isSignedUrlExpired(expiredTxUrl, 30_000), true);
    assert.equal(isSignedUrlExpired(validTxUrl, 30_000), false);

    // 2. Reject decimal strings falsely passed as txTime
    const decimalTxUrl = `https://pull.niur.live/live/feed.m3u8?txSecret=abc&txTime=1731456789`;
    assert.equal(extractSignedUrlExpiryMs(decimalTxUrl), null, '10-digit decimal passed as txTime must be rejected');

    // 3. auth_key: Aliyun 4-part structure
    const expiredAuthUrl = `https://pull06.scstream.net/live/feed.m3u8?auth_key=${nowSec - 10}-0-0-a1b2c3d4e5f6`;
    const validAuthUrl = `https://pull06.scstream.net/live/feed.m3u8?auth_key=${nowSec + 1200}-0-0-a1b2c3d4e5f6`;
    const malformedAuthUrl = `https://pull06.scstream.net/live/feed.m3u8?auth_key=invalid-token`;

    assert.equal(isSignedUrlExpired(expiredAuthUrl, 30_000), true);
    assert.equal(isSignedUrlExpired(validAuthUrl, 30_000), false);
    assert.equal(extractSignedUrlExpiryMs(malformedAuthUrl), null, 'Malformed auth_key must be rejected');
  });

  // ---------------------------------------------------------------------------
  // Test 13: Multiple followers waiting beyond 3 seconds (3.5s slow leader) with NO duplicate upstream dispatch
  // ---------------------------------------------------------------------------
  await test('13. Multiple followers waiting beyond 3 seconds (3.5s slow leader) with NO duplicate dispatch', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_man_city_vs_liverpool';
    const l2CacheKey = 'vnres_cat_man_city_vs_liverpool';
    const mockFixtureData = { matchId: '1003', name: 'Man City vs Liverpool', streams: [{ id: 's3', url: 'https://pull.niur.live/feed.m3u8' }] };

    // Worker 1 is dispatched as leader with 3,500ms delay.
    const p1 = worker1.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 3500, mockData: mockFixtureData });
    // Brief stagger to ensure Worker 1 claims lock first
    await new Promise((r) => setTimeout(r, 60));

    // Worker 2 and Worker 3 are followers waiting with 6,500ms default timeout.
    const [fetch2, fetch3] = await Promise.all([
      worker2.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 3500, mockData: mockFixtureData }),
      worker3.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 3500, mockData: mockFixtureData }),
    ]);
    const fetch1 = await p1;

    // All three workers must return the correct fixture data
    assert.equal(fetch1.data.matchId, '1003');
    assert.equal(fetch2.data.matchId, '1003');
    assert.equal(fetch3.data.matchId, '1003');

    // Exactly one worker must have executed the upstream fetch
    const totalUpstream = (fetch1.upstreamCalled ? 1 : 0) + (fetch2.upstreamCalled ? 1 : 0) + (fetch3.upstreamCalled ? 1 : 0);
    assert.equal(totalUpstream, 1, 'Only one upstream request must be executed across all workers');
    assert.equal(fetch1.upstreamCalled, true, 'Worker 1 (designated leader) must execute the upstream fetch');
    assert.equal(fetch2.upstreamCalled, false, 'Worker 2 (follower) must NOT execute upstream fetch');
    assert.equal(fetch3.upstreamCalled, false, 'Worker 3 (follower) must NOT execute upstream fetch');
  });

  // ---------------------------------------------------------------------------
  // Test 14: Leader completing near 5-second upstream timeout (4.5s delay) with NO duplicate upstream dispatch
  // ---------------------------------------------------------------------------
  await test('14. Leader completing near 5-second upstream timeout (4.5s delay) with NO duplicate dispatch', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_juventus_vs_inter';
    const l2CacheKey = 'vnres_cat_juventus_vs_inter';
    const mockFixtureData = { matchId: '1004', name: 'Derby d Italia' };

    // Worker 1 is dispatched as leader with 4,500ms delay (near 5s HTTP timeout)
    const p1 = worker1.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 4500, mockData: mockFixtureData });
    await new Promise((r) => setTimeout(r, 60));

    // Worker 2 is follower
    const fetch2 = await worker2.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 4500, mockData: mockFixtureData });
    const fetch1 = await p1;

    assert.equal(fetch1.data.matchId, '1004');
    assert.equal(fetch2.data.matchId, '1004');

    const totalUpstream = (fetch1.upstreamCalled ? 1 : 0) + (fetch2.upstreamCalled ? 1 : 0);
    assert.equal(totalUpstream, 1, 'Only one upstream request must be executed across workers');
    assert.equal(fetch1.upstreamCalled, true);
    assert.equal(fetch2.upstreamCalled, false);
  });

  // ---------------------------------------------------------------------------
  // Test 15: Leader failure triggers cooldown and followers abort without duplicate upstream fetch
  // ---------------------------------------------------------------------------
  await test('15. Leader failure triggers cooldown and follower aborts without duplicate upstream fetch', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_failed_leader_test';
    const l2CacheKey = 'vnres_cat_failed_leader_test';

    // Worker 1 fails and sets 30s cooldown
    let worker1Failed = false;
    try {
      await worker1.send('single_flight_fetch', {
        lockKey,
        l2CacheKey,
        delayMs: 200,
        shouldFail: true,
        failMessage: 'Upstream HTTP 503',
      });
    } catch {
      worker1Failed = true;
      // Worker 1 sets failure cooldown
      await worker1.send('set_cooldown', { provider: 'vnres', seconds: 30, reason: 'HTTP 503' });
    }
    assert.equal(worker1Failed, true, 'Worker 1 must fail as configured');

    // Worker 2 attempts fetch - must observe active cooldown and be rejected
    const status = await worker2.send('get_status', { provider: 'vnres' });
    assert.equal(status.inCooldown, true, 'Worker 2 must see active cooldown initiated by leader');

    const lease = await worker2.send('reserve_budget', { provider: 'vnres' });
    assert.equal(lease.allowed, false);
    assert.equal(lease.reason, 'COOLDOWN');
  });

  // ---------------------------------------------------------------------------
  // Test 16: Lock expiration and safe reacquisition by a competing worker
  // ---------------------------------------------------------------------------
  await test('16. Lock expiration and safe reacquisition by a competing worker', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_expiry_test';

    // Worker 1 acquires lock with 1-second TTL
    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: `owner-${worker1.pid}`, ttlSeconds: 1 });
    assert.equal(acq1.acquired, true, 'Worker 1 must acquire lock');

    // Worker 2 immediately attempts acquisition -> must be rejected
    const acq2Immediate = await worker2.send('acquire_lock', { lockKey, ownerId: `owner-${worker2.pid}`, ttlSeconds: 10 });
    assert.equal(acq2Immediate.acquired, false, 'Worker 2 must be rejected while Worker 1 lease is active');

    // Wait 1.2 seconds for Worker 1 lease to expire
    await new Promise((r) => setTimeout(r, 1200));

    // Worker 2 attempts acquisition -> must succeed (reacquisition of expired lease)
    const acq2AfterExpiry = await worker2.send('acquire_lock', { lockKey, ownerId: `owner-${worker2.pid}`, ttlSeconds: 10 });
    assert.equal(acq2AfterExpiry.acquired, true, 'Worker 2 must reacquire expired lease');

    await worker2.send('release_lock', { lockKey, ownerId: `owner-${worker2.pid}`, fencingToken: acq2AfterExpiry.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test 17: Old owner attempting to release a reassigned lock cannot delete new owner lease
  // ---------------------------------------------------------------------------
  await test('17. Old owner attempting to release a reassigned lock cannot delete new owner lease', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_reassignment_test';

    // Worker 1 acquires lock with 1-second TTL
    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: `owner-${worker1.pid}`, ttlSeconds: 1 });

    // Wait 1.2s for lease to expire
    await new Promise((r) => setTimeout(r, 1200));

    // Worker 2 acquires the expired lease
    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: `owner-${worker2.pid}`, ttlSeconds: 10 });
    assert.equal(acq2.acquired, true, 'Worker 2 acquires expired lock');

    // Delayed Worker 1 attempts to release the lock with its old ownerId and stale token
    const oldRelease = await worker1.send('release_lock', { lockKey, ownerId: `owner-${worker1.pid}`, fencingToken: acq1.fencingToken });
    assert.equal(oldRelease.released, false, 'Old owner cannot release lock now owned by Worker 2');

    // Worker 3 attempts to acquire lock -> must be rejected because Worker 2 still owns it!
    const acq3 = await worker3.send('acquire_lock', { lockKey, ownerId: `owner-${worker3.pid}`, ttlSeconds: 10 });
    assert.equal(acq3.acquired, false, 'Worker 2 lock must still be active and protected');

    // Clean up: Worker 2 releases its own lock
    const cleanRelease = await worker2.send('release_lock', { lockKey, ownerId: `owner-${worker2.pid}`, fencingToken: acq2.fencingToken });
    assert.equal(cleanRelease.released, true, 'Worker 2 releases its own lock');
  });

  // ---------------------------------------------------------------------------
  // Test 18: Dedicated cleanup safety around active records
  // ---------------------------------------------------------------------------
  await test('18. Dedicated cleanup safety around active records', async () => {
    await broker.store.resetAll('vnres');

    // 1. Setup Reservations:
    // One active reservation (now)
    await worker1.send('reserve_budget', { provider: 'vnres' });
    // One stale reservation (simulated older than 1 hour in store)
    const list = (broker.store as any).reservations.get('vnres') || [];
    list.push(Date.now() - 7200 * 1000); // 2 hours ago
    (broker.store as any).reservations.set('vnres', list);

    // 2. Setup Locks:
    // One active lock (expires in 10s)
    await worker1.send('acquire_lock', { lockKey: 'active_lock', ownerId: 'w1', ttlSeconds: 10 });
    // One expired lock (expired 5s ago)
    (broker.store as any).locks.set('expired_lock', { ownerId: 'w1', expiresAt: Date.now() - 5000 });

    // 3. Setup L2 Cache:
    // One active cache entry
    (broker.store as any).l2Cache.set('active_cache', {
      payload: { ok: true },
      cachedAt: Date.now(),
      freshUntil: Date.now() + 30000,
      staleUntil: Date.now() + 60000,
      fencingToken: 1,
    });
    // One expired cache entry
    (broker.store as any).l2Cache.set('expired_cache', {
      payload: { stale: true },
      cachedAt: Date.now() - 100000,
      freshUntil: Date.now() - 50000,
      staleUntil: Date.now() - 10000, // expired stale window
    });

    // Run cleanup
    const cleanupRes = await worker1.send('cleanup', {});
    assert.equal(cleanupRes.deletedReservations, 1, 'Stale reservation older than 1hr must be deleted');
    assert.equal(cleanupRes.deletedLocks, 1, 'Expired lock must be deleted');
    assert.equal(cleanupRes.deletedCacheEntries, 1, 'Expired cache entry must be deleted');

    // Verify ACTIVE records were preserved:
    const activeLockAcq = await worker2.send('acquire_lock', { lockKey: 'active_lock', ownerId: 'w2', ttlSeconds: 10 });
    assert.equal(activeLockAcq.acquired, false, 'Active lock must NOT be deleted by cleanup');

    const activeCacheRead = await worker2.send('read_l2_cache', { key: 'active_cache' });
    assert.ok(activeCacheRead !== null, 'Active cache must NOT be deleted by cleanup');
    assert.equal(activeCacheRead.payload.ok, true);

    const statusAfter = await worker1.send('get_status', { provider: 'vnres' });
    assert.equal(statusAfter.requestsInWindow, 1, 'Active reservation within window must be preserved');
  });

  // ---------------------------------------------------------------------------
  // Test 19: F-22-02 Fencing token monotonicity and stale leader L2 publication rejection
  // ---------------------------------------------------------------------------
  await test('19. F-22-02 Fencing token monotonicity and stale leader L2 publication rejection', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_fencing_test';
    const l2CacheKey = 'vnres_cat_fencing_test';

    // 1. Worker 1 acquires lock with 1-second lease -> receives fencing token T1
    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: `owner-${worker1.pid}`, ttlSeconds: 1 });
    assert.equal(acq1.acquired, true, 'Worker 1 acquires lock');
    assert.ok(acq1.fencingToken > 0, 'Worker 1 receives a valid fencing token');
    const token1 = acq1.fencingToken;

    // 2. Worker 1 experiences abnormal delay/pause beyond 1-second lease TTL
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Worker 2 acquires the expired lease -> receives fencing token T2 (T2 must be > T1)
    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: `owner-${worker2.pid}`, ttlSeconds: 10 });
    assert.equal(acq2.acquired, true, 'Worker 2 acquires expired lock');
    assert.ok(acq2.fencingToken > token1, `Token 2 (${acq2.fencingToken}) must be strictly greater than Token 1 (${token1})`);
    const token2 = acq2.fencingToken;

    // 4. Worker 2 completes its fresh fetch and publishes Version 2 to L2 cache using Token 2
    const write2 = await worker2.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 2, payload: 'Fresh Stream Manifest V2' },
      fencingToken: token2,
      lockKey,
      ownerId: `owner-${worker2.pid}`,
    });
    assert.equal(write2.success, true, 'Worker 2 fresh write with current fencing token must succeed');

    // 5. Delayed Worker 1 wakes up and attempts to publish stale Version 1 using obsolete Token 1
    const write1Stale = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 1, payload: 'Stale Stream Manifest V1' },
      fencingToken: token1,
      lockKey,
      ownerId: `owner-${worker1.pid}`,
    });
    assert.equal(write1Stale.success, false, 'Delayed Worker 1 publication with obsolete fencing token must be REJECTED');

    // 6. Verify that Version 2 was preserved in L2 cache and was NOT clobbered by Worker 1
    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.ok(cacheEntry !== null);
    assert.equal(cacheEntry.payload.version, 2, 'L2 cache must retain Version 2 data without overwrite');
    assert.equal(cacheEntry.payload.payload, 'Fresh Stream Manifest V2');

    await worker2.send('release_lock', { lockKey, ownerId: `owner-${worker2.pid}`, fencingToken: acq2.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test 20: F-22-01 Waiter timeout produces 503 ANOTHER_WORKER_FETCHING, never empty streams
  // ---------------------------------------------------------------------------
  await test('20. F-22-01 Waiter timeout produces 503 ANOTHER_WORKER_FETCHING, never empty streams', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_timeout_contract_test';
    const l2CacheKey = 'vnres_cat_timeout_contract_test';

    // Worker 1 holds lock with long delay (3 seconds)
    const p1 = worker1.send('single_flight_fetch', {
      lockKey,
      l2CacheKey,
      delayMs: 3000,
      mockData: { streams: [{ id: 's1', url: 'https://pull.niur.live/feed.m3u8' }] },
    });
    await new Promise((r) => setTimeout(r, 60));

    // Worker 2 waits with a short waiter timeout of 400ms
    let worker2Error: any = null;
    try {
      await worker2.send('single_flight_fetch', {
        lockKey,
        l2CacheKey,
        waitTimeoutMs: 400,
        pollIntervalMs: 50,
      });
    } catch (err: any) {
      worker2Error = err;
    }

    assert.ok(worker2Error !== null, 'Follower must throw when waiter timeout elapses');
    assert.match(
      worker2Error.message,
      /Another worker is currently fetching upstream/i,
      'Error message must indicate worker coordination timeout'
    );

    // Verify L2 cache has not been populated with empty result
    const l2DuringTimeout = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(l2DuringTimeout, null, 'Coordination timeout must NOT write empty result to cache');

    // Worker 1 finishes safely
    await p1;
  });

  // ---------------------------------------------------------------------------
  // Test 21: F-22-03 Single-flight request coalescing protects upstream budget
  // ---------------------------------------------------------------------------
  await test('21. F-22-03 Single-flight request coalescing protects upstream budget', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_budget_protection_test';
    const l2CacheKey = 'vnres_cat_budget_protection_test';
    const mockFixtureData = { matchId: '1099', name: 'Coalesced Fixture' };

    // Simulate 3 concurrent worker dispatches for the exact same fixture
    // Only the elected leader dispatches upstream; followers wait and read L2.
    const [f1, f2, f3] = await Promise.all([
      worker1.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 250, mockData: mockFixtureData }),
      worker2.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 250, mockData: mockFixtureData }),
      worker3.send('single_flight_fetch', { lockKey, l2CacheKey, delayMs: 250, mockData: mockFixtureData }),
    ]);

    assert.equal(f1.data.name, 'Coalesced Fixture');
    assert.equal(f2.data.name, 'Coalesced Fixture');
    assert.equal(f3.data.name, 'Coalesced Fixture');

    const totalUpstream = (f1.upstreamCalled ? 1 : 0) + (f2.upstreamCalled ? 1 : 0) + (f3.upstreamCalled ? 1 : 0);
    assert.equal(totalUpstream, 1, 'Exactly one upstream request must be executed across all workers');
  });

  // ---------------------------------------------------------------------------
  // Test 22: F-22-06 Bounded exponential backoff and jitter polling
  // ---------------------------------------------------------------------------
  await test('22. F-22-06 Bounded exponential backoff and jitter polling', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_backoff_test';
    const l2CacheKey = 'vnres_cat_backoff_test';

    // Worker 1 holds lock for 800ms
    const p1 = worker1.send('single_flight_fetch', {
      lockKey,
      l2CacheKey,
      delayMs: 800,
      mockData: { ok: true },
    });
    await new Promise((r) => setTimeout(r, 60));

    // Worker 2 polls with backoff enabled (starts at 50ms, ramps up to 300ms)
    const f2 = await worker2.send('single_flight_fetch', {
      lockKey,
      l2CacheKey,
      waitTimeoutMs: 3000,
      pollIntervalMs: 50,
      useBackoff: true,
    });

    assert.equal(f2.data.ok, true, 'Worker 2 must successfully receive data using backoff polling');
    await p1;
  });

  // ===========================================================================
  // Section 7: Phase 2.27 Atomic Lease Ownership Concurrency Regression Tests (Tests A through J)
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Test A: Valid leader with unexpired lease can publish
  // ---------------------------------------------------------------------------
  await test('Test A: Valid leader with unexpired lease can publish', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_a';
    const l2CacheKey = 'vnres_cat_test_a';
    const ownerId = `owner_${worker1.pid}_a`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId, ttlSeconds: 5 });
    assert.equal(acq.acquired, true, 'Worker 1 acquires lock');
    assert.ok(acq.fencingToken > 0, 'Worker 1 receives fencing token');

    const write = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { fixture: 'Match A', status: 'live' },
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId,
    });
    assert.equal(write.success, true, 'Valid leader must successfully publish to L2 cache');

    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.ok(cacheEntry !== null);
    assert.equal(cacheEntry.payload.fixture, 'Match A');

    await worker1.send('release_lock', { lockKey, ownerId, fencingToken: acq.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test B: Expired lease without replacement is rejected
  // ---------------------------------------------------------------------------
  await test('Test B: Expired lease without replacement is rejected', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_b';
    const l2CacheKey = 'vnres_cat_test_b';
    const ownerId = `owner_${worker1.pid}_b`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId, ttlSeconds: 1 });
    assert.equal(acq.acquired, true);

    // Sleep past TTL to expire the lease
    await new Promise((r) => setTimeout(r, 1200));

    // No other worker acquires the lock. Worker 1 attempts publication.
    const write = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { fixture: 'Match B Stale' },
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId,
    });
    assert.equal(write.success, false, 'Expired leader publication must be rejected even with no replacement');

    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(cacheEntry, null, 'Cache must remain unpopulated');
  });

  // ---------------------------------------------------------------------------
  // Test C: Replacement still fetching rejects delayed leader
  // ---------------------------------------------------------------------------
  await test('Test C: Replacement still fetching rejects delayed leader', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_c';
    const l2CacheKey = 'vnres_cat_test_c';
    const owner1 = `owner_${worker1.pid}_c`;
    const owner2 = `owner_${worker2.pid}_c`;

    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 1 });
    assert.equal(acq1.acquired, true);

    // Sleep past TTL
    await new Promise((r) => setTimeout(r, 1200));

    // Worker 2 acquires the expired lock
    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: owner2, ttlSeconds: 10 });
    assert.equal(acq2.acquired, true);
    assert.ok(acq2.fencingToken > acq1.fencingToken);

    // Worker 2 is still fetching and has NOT published to L2 cache yet.
    // Worker 1 resumes and attempts publication with its stale token.
    const write1Stale = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 'stale_worker1' },
      fencingToken: acq1.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(write1Stale.success, false, 'Delayed leader must be rejected while replacement is fetching');

    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(cacheEntry, null, 'Cache must not receive stale data from Worker 1');

    await worker2.send('release_lock', { lockKey, ownerId: owner2, fencingToken: acq2.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test D: Replacement already published rejects delayed leader
  // ---------------------------------------------------------------------------
  await test('Test D: Replacement already published rejects delayed leader', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_d';
    const l2CacheKey = 'vnres_cat_test_d';
    const owner1 = `owner_${worker1.pid}_d`;
    const owner2 = `owner_${worker2.pid}_d`;

    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 1 });
    await new Promise((r) => setTimeout(r, 1200));

    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: owner2, ttlSeconds: 10 });
    assert.equal(acq2.acquired, true);

    // Worker 2 publishes
    const write2 = await worker2.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 2, payload: 'Fresh V2' },
      fencingToken: acq2.fencingToken,
      lockKey,
      ownerId: owner2,
    });
    assert.equal(write2.success, true);

    // Worker 1 attempts to publish stale Version 1
    const write1Stale = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 1, payload: 'Stale V1' },
      fencingToken: acq1.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(write1Stale.success, false, 'Delayed leader must be rejected after replacement published');

    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(cacheEntry.payload.version, 2, 'Cache must preserve replacement data');

    await worker2.send('release_lock', { lockKey, ownerId: owner2, fencingToken: acq2.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test E: Missing lock row results in rejection
  // ---------------------------------------------------------------------------
  await test('Test E: Missing lock row results in rejection', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_e';
    const l2CacheKey = 'vnres_cat_test_e';
    const owner1 = `owner_${worker1.pid}_e`;

    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 5 });
    assert.equal(acq1.acquired, true);

    // Explicitly release / remove lock
    await worker1.send('release_lock', { lockKey, ownerId: owner1, fencingToken: acq1.fencingToken });

    // Worker 1 attempts publication with its previously captured token
    const write = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { payload: 'Missing Lock Write' },
      fencingToken: acq1.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(write.success, false, 'Publication must be rejected when lock row is missing');

    const cacheEntry = await worker2.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(cacheEntry, null);
  });

  // ---------------------------------------------------------------------------
  // Test F: Owner mismatch results in rejection
  // ---------------------------------------------------------------------------
  await test('Test F: Owner mismatch results in rejection', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_f';
    const l2CacheKey = 'vnres_cat_test_f';
    const owner1 = `owner_${worker1.pid}_f`;
    const imposter = `owner_${worker2.pid}_imposter`;

    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 5 });
    assert.equal(acq1.acquired, true);

    // Imposter attempts publication with Worker 1's token but its own owner ID
    const writeImposter = await worker2.send('write_l2_cache', {
      key: l2CacheKey,
      data: { payload: 'Imposter Write' },
      fencingToken: acq1.fencingToken,
      lockKey,
      ownerId: imposter,
    });
    assert.equal(writeImposter.success, false, 'Publication must be rejected when owner identity does not match lock');

    await worker1.send('release_lock', { lockKey, ownerId: owner1, fencingToken: acq1.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test G: Token mismatch results in rejection
  // ---------------------------------------------------------------------------
  await test('Test G: Token mismatch results in rejection', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_g';
    const l2CacheKey = 'vnres_cat_test_g';
    const owner1 = `owner_${worker1.pid}_g`;

    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 5 });
    assert.equal(acq1.acquired, true);

    // Worker 1 attempts publication with altered fencing token
    const writeBadToken = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { payload: 'Bad Token Write' },
      fencingToken: acq1.fencingToken + 999,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(writeBadToken.success, false, 'Publication must be rejected when fencing token does not match lock');

    await worker1.send('release_lock', { lockKey, ownerId: owner1, fencingToken: acq1.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test H: Concurrent acquisition and publication
  // ---------------------------------------------------------------------------
  await test('Test H: Concurrent acquisition and publication preserves ownership safety', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_h';
    const l2CacheKey = 'vnres_cat_test_h';
    const owner1 = `owner_${worker1.pid}_h`;
    const owner2 = `owner_${worker2.pid}_h`;

    // Worker 1 acquires 1-second lease
    const acq1 = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 1 });
    assert.equal(acq1.acquired, true);

    // Wait for lease expiry
    await new Promise((r) => setTimeout(r, 1200));

    // Concurrently: Worker 2 acquires the expired lock while Worker 1 attempts to publish
    const [resAcq2, resWrite1] = await Promise.all([
      worker2.send('acquire_lock', { lockKey, ownerId: owner2, ttlSeconds: 5 }),
      worker1.send('write_l2_cache', {
        key: l2CacheKey,
        data: { version: 'stale_w1' },
        fencingToken: acq1.fencingToken,
        lockKey,
        ownerId: owner1,
      }),
    ]);

    // Regardless of which executes first, Worker 1 MUST be rejected because its lease expired
    assert.equal(resWrite1.success, false, 'Worker 1 publication with expired lease must be rejected');
    assert.equal(resAcq2.acquired, true, 'Worker 2 must successfully acquire expired lock');

    // Worker 2 publishes fresh data
    const resWrite2 = await worker2.send('write_l2_cache', {
      key: l2CacheKey,
      data: { version: 'fresh_w2' },
      fencingToken: resAcq2.fencingToken,
      lockKey,
      ownerId: owner2,
    });
    assert.equal(resWrite2.success, true);

    const cacheEntry = await worker1.send('read_l2_cache', { key: l2CacheKey });
    assert.equal(cacheEntry.payload.version, 'fresh_w2');

    await worker2.send('release_lock', { lockKey, ownerId: owner2, fencingToken: resAcq2.fencingToken });
  });

  // ---------------------------------------------------------------------------
  // Test I: Independent fixtures operate without cross-interference
  // ---------------------------------------------------------------------------
  await test('Test I: Independent fixtures operate without cross-interference', async () => {
    await broker.store.resetAll('vnres');
    const lockKey1 = 'vnres_lock_fix1';
    const l2CacheKey1 = 'vnres_cat_fix1';
    const lockKey2 = 'vnres_lock_fix2';
    const l2CacheKey2 = 'vnres_cat_fix2';
    const owner1 = `owner_${worker1.pid}_fix1`;
    const owner2 = `owner_${worker2.pid}_fix2`;

    const [acq1, acq2] = await Promise.all([
      worker1.send('acquire_lock', { lockKey: lockKey1, ownerId: owner1, ttlSeconds: 5 }),
      worker2.send('acquire_lock', { lockKey: lockKey2, ownerId: owner2, ttlSeconds: 5 }),
    ]);

    assert.equal(acq1.acquired, true);
    assert.equal(acq2.acquired, true);

    const [write1, write2] = await Promise.all([
      worker1.send('write_l2_cache', { key: l2CacheKey1, data: { fixture: 1 }, fencingToken: acq1.fencingToken, lockKey: lockKey1, ownerId: owner1 }),
      worker2.send('write_l2_cache', { key: l2CacheKey2, data: { fixture: 2 }, fencingToken: acq2.fencingToken, lockKey: lockKey2, ownerId: owner2 }),
    ]);

    assert.equal(write1.success, true);
    assert.equal(write2.success, true);

    const [c1, c2] = await Promise.all([
      worker2.send('read_l2_cache', { key: l2CacheKey1 }),
      worker1.send('read_l2_cache', { key: l2CacheKey2 }),
    ]);

    assert.equal(c1.payload.fixture, 1);
    assert.equal(c2.payload.fixture, 2);

    await Promise.all([
      worker1.send('release_lock', { lockKey: lockKey1, ownerId: owner1, fencingToken: acq1.fencingToken }),
      worker2.send('release_lock', { lockKey: lockKey2, ownerId: owner2, fencingToken: acq2.fencingToken }),
    ]);
  });

  // ---------------------------------------------------------------------------
  // Test J: Duplicate publication idempotency and expiration rejection
  // ---------------------------------------------------------------------------
  await test('Test J: Duplicate publication follows idempotency and rejects post-expiration', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'vnres_lock_test_j';
    const l2CacheKey = 'vnres_cat_test_j';
    const owner1 = `owner_${worker1.pid}_j`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId: owner1, ttlSeconds: 5 });
    assert.equal(acq.acquired, true);

    // First publication within valid lease
    const write1 = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { seq: 1 },
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(write1.success, true);

    // Duplicate publication with same token and unexpired lease (idempotent write)
    const writeDuplicate = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { seq: 2 },
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(writeDuplicate.success, true, 'Duplicate write within valid lease must succeed');

    // Release lock
    await worker1.send('release_lock', { lockKey, ownerId: owner1, fencingToken: acq.fencingToken });

    // Attempt publication after lock release
    const writeAfterRelease = await worker1.send('write_l2_cache', {
      key: l2CacheKey,
      data: { seq: 3 },
      fencingToken: acq.fencingToken,
      lockKey,
      ownerId: owner1,
    });
    assert.equal(writeAfterRelease.success, false, 'Publication after lock release must be rejected');
  });

  // ---------------------------------------------------------------------------
  // SECTION 8: TOKEN-FENCED DISTRIBUTED LOCK RELEASE (Phase 2.29 / AUDIT-28-04)
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 8: Token-Fenced Distributed Lock Release (AUDIT-28-04) ---');

  // Scenario 1: Correct owner and correct token release the lease
  await test('Release Scenario 1: Correct owner and correct token release the lease', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'rel_fence_scen1';
    const owner = `worker_${worker1.pid}_r1`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId: owner, ttlSeconds: 10 });
    assert.equal(acq.acquired, true);

    const rel = await worker1.send('release_lock', { lockKey, ownerId: owner, fencingToken: acq.fencingToken });
    assert.equal(rel.released, true, 'Valid owner and token must successfully release');

    // Verify lock is gone: Worker 2 can acquire immediately
    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: `worker_${worker2.pid}_r1`, ttlSeconds: 5 });
    assert.equal(acq2.acquired, true, 'Lock must be available immediately after release');
    await worker2.send('release_lock', { lockKey, ownerId: `worker_${worker2.pid}_r1`, fencingToken: acq2.fencingToken });
  });

  // Scenario 2: Correct owner but stale token cannot release lease
  await test('Release Scenario 2: Correct owner but stale token cannot release lease', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'rel_fence_scen2';
    const owner = `worker_${worker1.pid}_r2`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId: owner, ttlSeconds: 10 });
    assert.equal(acq.acquired, true);

    // Stale token (e.g. acq.fencingToken - 1 or invalid)
    const rel = await worker1.send('release_lock', { lockKey, ownerId: owner, fencingToken: acq.fencingToken - 1 });
    assert.equal(rel.released, false, 'Stale token must NOT release active lease');

    // Lock must still be held
    const acq2 = await worker2.send('acquire_lock', { lockKey, ownerId: `worker_${worker2.pid}_r2`, ttlSeconds: 5 });
    assert.equal(acq2.acquired, false, 'Lock must still be held by owner');

    await worker1.send('release_lock', { lockKey, ownerId: owner, fencingToken: acq.fencingToken });
  });

  // Scenario 3: Wrong owner cannot release lease
  await test('Release Scenario 3: Wrong owner cannot release lease', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'rel_fence_scen3';
    const owner = `worker_${worker1.pid}_r3`;
    const imposter = `worker_${worker2.pid}_imposter3`;

    const acq = await worker1.send('acquire_lock', { lockKey, ownerId: owner, ttlSeconds: 10 });
    assert.equal(acq.acquired, true);

    const rel = await worker2.send('release_lock', { lockKey, ownerId: imposter, fencingToken: acq.fencingToken });
    assert.equal(rel.released, false, 'Wrong owner must NOT release lease');

    await worker1.send('release_lock', { lockKey, ownerId: owner, fencingToken: acq.fencingToken });
  });

  // Scenario 4: Missing lock release does not error or delete other locks
  await test('Release Scenario 4: Missing lock release does not error or delete other locks', async () => {
    await broker.store.resetAll('vnres');
    const activeLockKey = 'rel_fence_scen4_active';
    const missingLockKey = 'rel_fence_scen4_missing';
    const owner = `worker_${worker1.pid}_r4`;

    const acqActive = await worker1.send('acquire_lock', { lockKey: activeLockKey, ownerId: owner, ttlSeconds: 10 });
    assert.equal(acqActive.acquired, true);

    const relMissing = await worker1.send('release_lock', { lockKey: missingLockKey, ownerId: owner, fencingToken: 9999 });
    assert.equal(relMissing.released, false, 'Missing lock release must return false safely');

    // Active lock must remain intact
    const acqTry = await worker2.send('acquire_lock', { lockKey: activeLockKey, ownerId: `worker_${worker2.pid}`, ttlSeconds: 5 });
    assert.equal(acqTry.acquired, false, 'Active lock must remain protected');

    await worker1.send('release_lock', { lockKey: activeLockKey, ownerId: owner, fencingToken: acqActive.fencingToken });
  });

  // Scenario 5 & 6: Old execution cannot release a newer lease held by the same worker identity
  await test('Release Scenario 5 & 6: Overdue execution cannot release newer lease held by same worker identity', async () => {
    await broker.store.resetAll('vnres');
    const lockKey = 'rel_fence_scen5_reused_owner';
    const sharedOwnerId = `worker_${worker1.pid}_reused`;

    // 1. Worker 1 acquires lock on request A with 1-second TTL -> token T1
    const acqA = await worker1.send('acquire_lock', { lockKey, ownerId: sharedOwnerId, ttlSeconds: 1 });
    assert.equal(acqA.acquired, true);
    const tokenA = acqA.fencingToken;

    // 2. Wait 1.2s for lease to expire
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Worker 1 handles request B and re-acquires the same lock -> token T2 (T2 > T1)
    const acqB = await worker1.send('acquire_lock', { lockKey, ownerId: sharedOwnerId, ttlSeconds: 10 });
    assert.equal(acqB.acquired, true);
    const tokenB = acqB.fencingToken;
    assert.ok(tokenB > tokenA, 'Reacquired lease must have newer token');

    // 4. Delayed execution of request A runs its finally block with token T1
    const relStale = await worker1.send('release_lock', { lockKey, ownerId: sharedOwnerId, fencingToken: tokenA });
    assert.equal(relStale.released, false, 'Overdue execution with stale token must NOT release the newer lease');

    // 5. Worker 2 attempts acquisition -> must be rejected because request B lease is still active!
    const acqOther = await worker2.send('acquire_lock', { lockKey, ownerId: `worker_${worker2.pid}`, ttlSeconds: 5 });
    assert.equal(acqOther.acquired, false, 'Newer lease must remain active despite delayed release from previous request');

    // 6. Request B completes and cleanly releases its lease with token T2
    const relActive = await worker1.send('release_lock', { lockKey, ownerId: sharedOwnerId, fencingToken: tokenB });
    assert.equal(relActive.released, true, 'Active lease released cleanly with matching token');
  });

  // ---------------------------------------------------------------------------
  // Test 12: Database failure behavior
  // ---------------------------------------------------------------------------
  await test('12. Database failure behavior', async () => {
    // Simulate database failure by stopping coordination broker
    await broker.stop();

    // Worker 1 attempts to reserve budget with broker offline
    let failedSafely = false;
    try {
      await worker1.send('reserve_budget', { provider: 'vnres' });
    } catch {
      failedSafely = true;
    }

    assert.equal(failedSafely, true, 'Worker must fail-closed when coordination broker is unavailable');
  });

  // Cleanup
  worker1.kill();
  worker2.kill();
  worker3.kill();

  console.log('\n================================================================================');
  console.log(`Phase 2.19 Multi-Worker Concurrency Suite: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in multi-worker concurrency suite:', err);
  process.exit(1);
});
