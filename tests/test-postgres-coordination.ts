// Standalone test environment: stub 'server-only' package before loading server modules
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';
import { Client } from 'pg';

console.log('================================================================================');
console.log('--- ZimKickOff Developer API Phase 2.27: PostgreSQL Coordination Tests ---');
console.log('================================================================================');

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
    failed++;
  }
}

// Configuration strictly bounded to local disposable test container
const DB_CONFIG = {
  host: process.env.TEST_POSTGRES_HOST || '127.0.0.1',
  port: parseInt(process.env.TEST_POSTGRES_PORT || '54321', 10),
  user: process.env.TEST_POSTGRES_USER || 'postgres',
  password: process.env.TEST_POSTGRES_PASSWORD || 'postgres',
  database: process.env.TEST_POSTGRES_DB || 'zimkickoff_test',
  connectionTimeoutMillis: 3000,
};

// Strict safety check: Never connect to remote, staging, or production hosts
function assertSafeLocalHost(host: string) {
  const allowed = ['127.0.0.1', 'localhost', '::1'];
  if (!allowed.includes(host)) {
    throw new Error(`SECURITY HALT: Disallowed database host '${host}'. Integration tests may only run against local disposable test instances.`);
  }
}

const REQUIRE_POSTGRES_TESTS = process.env.REQUIRE_POSTGRES_TESTS === 'true';

async function runPostgresCoordinationSuite() {
  assertSafeLocalHost(DB_CONFIG.host);

  const client = new Client(DB_CONFIG);
  let connected = false;

  try {
    await client.connect();
    connected = true;
  } catch (err: any) {
    if (REQUIRE_POSTGRES_TESTS) {
      console.error(`\n[FATAL] REQUIRE_POSTGRES_TESTS is set but unable to connect to test database at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
      console.error(`  Details: ${err.message}`);
      process.exit(1);
    }
    console.log(`\n[NOTICE] Unable to connect to local test database at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`  Details: ${err.message}`);
    console.log('[STATUS: SKIPPED — MIGRATION NOT APPLIED] Local disposable PostgreSQL test database is not available.');
    console.log('Exiting safely with code 0.\n');
    return;
  }

  try {
    // Check if migration 20261114000000_upstream_coordination_and_l2_cache.sql has been applied
    const requiredTables = [
      'api_upstream_status',
      'api_upstream_budget_reservations',
      'api_distributed_locks',
      'api_catalog_cache',
    ];

    const tableCheckRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1::text[]);
    `, [requiredTables]);

    const existingTables = new Set(tableCheckRes.rows.map((r: any) => r.table_name));
    const missingTables = requiredTables.filter(t => !existingTables.has(t));

    const seqCheckRes = await client.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public' 
        AND sequence_name = 'seq_coordination_fencing_token';
    `);
    const hasSequence = seqCheckRes.rows.length > 0;

    if (missingTables.length > 0 || !hasSequence) {
      const missing = [...missingTables, ...(hasSequence ? [] : ['seq_coordination_fencing_token'])];
      if (REQUIRE_POSTGRES_TESTS) {
        console.error(`\n[FATAL] REQUIRE_POSTGRES_TESTS is set but required coordination objects are missing: ${missing.join(', ')}`);
        process.exit(1);
      }
      console.log(`\n[NOTICE] Prerequisites for PostgreSQL coordination tests not met:`);
      console.log(`  Missing coordination object(s): ${missing.join(', ')}`);
      console.log(`  Reason: Migration 20261114000000_upstream_coordination_and_l2_cache.sql is unexecuted in this environment.`);
      console.log(`\n[STATUS: SKIPPED — MIGRATION NOT APPLIED] Integration tests prepared and validated, pending database migration.`);
      console.log('Exiting cleanly with code 0.\n');
      return;
    }

    // Set service_role for test execution
    await client.query('SET ROLE service_role;');

    console.log('\n--- 1. Valid Lease Publication ---');
    await test('1. Valid lease publication: Unexpired lease with matching token and owner succeeds', async () => {
      const lockKey = `lock:pg:test_valid:${Date.now()}`;
      const cacheKey = `cache:pg:test_valid:${Date.now()}`;
      const owner = `worker_valid_${Date.now()}`;
      const payload = { matchId: '1001', streams: [{ id: 's1', url: 'https://pull.niur.live/live.m3u8' }] };

      // Acquire lock with 10s TTL
      const acqRes = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner]
      );
      assert.equal(acqRes.rows[0].acquired, true);
      const token = Number(acqRes.rows[0].fencing_token);
      assert.ok(token > 0);

      // Publish with exact lock ownership parameters
      const writeRes = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1001', 'fix-1001', JSON.stringify(payload), token, lockKey, owner]
      );
      assert.equal(writeRes.rows[0].written, true, 'Valid lease publication must succeed');

      // Verify payload in api_catalog_cache
      const readRes = await client.query(
        `SELECT payload, fencing_token, fresh_until > clock_timestamp() AS not_expired FROM public.api_catalog_cache WHERE cache_key = $1;`,
        [cacheKey]
      );
      assert.equal(readRes.rows.length, 1);
      assert.deepEqual(readRes.rows[0].payload, payload);
      assert.equal(readRes.rows[0].not_expired, true);
      assert.equal(Number(readRes.rows[0].fencing_token), token);

      // Clean up
      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
      await client.query('DELETE FROM public.api_catalog_cache WHERE cache_key = $1;', [cacheKey]);
    });

    console.log('\n--- 2. Expired Lease Without Replacement ---');
    await test('2. Expired lease without replacement: Delayed worker rejected after lease expiry', async () => {
      const lockKey = `lock:pg:test_exp_no_rep:${Date.now()}`;
      const cacheKey = `cache:pg:test_exp_no_rep:${Date.now()}`;
      const owner = `worker_exp_${Date.now()}`;

      // Acquire lock with 1 second TTL
      const acqRes = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 1);`,
        [lockKey, owner]
      );
      assert.equal(acqRes.rows[0].acquired, true);
      const token = Number(acqRes.rows[0].fencing_token);

      // Sleep 1,200ms to allow lease to expire
      await new Promise(r => setTimeout(r, 1200));

      // Attempt publication after expiry
      const writeRes = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1002', 'fix-1002', JSON.stringify({ stale: true }), token, lockKey, owner]
      );
      assert.equal(writeRes.rows[0].written, false, 'Expired lease publication must be rejected');

      // Verify cache row does not exist
      const readRes = await client.query(
        `SELECT payload FROM public.api_catalog_cache WHERE cache_key = $1;`,
        [cacheKey]
      );
      assert.equal(readRes.rows.length, 0);

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
    });

    console.log('\n--- 3. Expired Lease With Replacement Still Fetching ---');
    await test('3. Expired lease with replacement still fetching: Delayed leader rejected before replacement publishes', async () => {
      const lockKey = `lock:pg:test_exp_fetching:${Date.now()}`;
      const cacheKey = `cache:pg:test_exp_fetching:${Date.now()}`;
      const owner1 = `worker1_fetching_${Date.now()}`;
      const owner2 = `worker2_fetching_${Date.now()}`;

      // Worker 1 acquires 1s lease
      const acq1 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 1);`,
        [lockKey, owner1]
      );
      const token1 = Number(acq1.rows[0].fencing_token);

      // Sleep past expiry
      await new Promise(r => setTimeout(r, 1200));

      // Worker 2 acquires the expired lease with 10s TTL
      const acq2 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner2]
      );
      assert.equal(acq2.rows[0].acquired, true);

      // Worker 1 attempts to publish with token 1 while Worker 2 is fetching (cache empty)
      const write1 = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1003', 'fix-1003', JSON.stringify({ stale: 'w1' }), token1, lockKey, owner1]
      );
      assert.equal(write1.rows[0].written, false, 'Worker 1 write must be rejected');

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
    });

    console.log('\n--- 4. Expired Lease After Replacement Publication ---');
    await test('4. Expired lease after replacement publication: Overwrite rejected, fresh data preserved', async () => {
      const lockKey = `lock:pg:test_exp_published:${Date.now()}`;
      const cacheKey = `cache:pg:test_exp_published:${Date.now()}`;
      const owner1 = `worker1_pub_${Date.now()}`;
      const owner2 = `worker2_pub_${Date.now()}`;

      const acq1 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 1);`,
        [lockKey, owner1]
      );
      const token1 = Number(acq1.rows[0].fencing_token);
      await new Promise(r => setTimeout(r, 1200));

      const acq2 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner2]
      );
      const token2 = Number(acq2.rows[0].fencing_token);

      // Worker 2 publishes Version 2
      const write2 = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1004', 'fix-1004', JSON.stringify({ version: 2 }), token2, lockKey, owner2]
      );
      assert.equal(write2.rows[0].written, true);

      // Delayed Worker 1 attempts publication with Version 1
      const write1 = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1004', 'fix-1004', JSON.stringify({ version: 1 }), token1, lockKey, owner1]
      );
      assert.equal(write1.rows[0].written, false, 'Stale write must be rejected');

      // Verify cache retains Version 2
      const readRes = await client.query(
        `SELECT payload FROM public.api_catalog_cache WHERE cache_key = $1;`,
        [cacheKey]
      );
      assert.deepEqual(readRes.rows[0].payload, { version: 2 });

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
      await client.query('DELETE FROM public.api_catalog_cache WHERE cache_key = $1;', [cacheKey]);
    });

    console.log('\n--- 5. Missing Lock Row Publication Rejection ---');
    await test('5. Missing lock row: Publication rejected when lock row is missing', async () => {
      const lockKey = `lock:pg:missing:${Date.now()}`;
      const cacheKey = `cache:pg:missing:${Date.now()}`;

      const write = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 999, $5, 'some_owner') AS written;`,
        [cacheKey, '1005', 'fix-1005', JSON.stringify({ data: 'missing' }), lockKey]
      );
      assert.equal(write.rows[0].written, false, 'Publication with non-existent lock must be rejected');
    });

    console.log('\n--- 6. Token Mismatch Rejection ---');
    await test('6. Token mismatch: Publication rejected when fencing token does not match lock', async () => {
      const lockKey = `lock:pg:mismatch:${Date.now()}`;
      const cacheKey = `cache:pg:mismatch:${Date.now()}`;
      const owner = `worker_mismatch_${Date.now()}`;

      const acq = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner]
      );
      const token = Number(acq.rows[0].fencing_token);

      const write = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1006', 'fix-1006', JSON.stringify({ data: 'bad_token' }), token + 50, lockKey, owner]
      );
      assert.equal(write.rows[0].written, false, 'Publication with mismatched token must be rejected');

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
    });

    console.log('\n--- 7. Owner Mismatch Rejection ---');
    await test('7. Owner mismatch: Publication rejected when owner ID does not match lock', async () => {
      const lockKey = `lock:pg:owner_mismatch:${Date.now()}`;
      const cacheKey = `cache:pg:owner_mismatch:${Date.now()}`;
      const legitimateOwner = `owner_legit_${Date.now()}`;
      const imposterOwner = `owner_imposter_${Date.now()}`;

      const acq = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, legitimateOwner]
      );
      const token = Number(acq.rows[0].fencing_token);

      const write = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`,
        [cacheKey, '1007', 'fix-1007', JSON.stringify({ data: 'imposter' }), token, lockKey, imposterOwner]
      );
      assert.equal(write.rows[0].written, false, 'Publication with mismatched owner must be rejected');

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
    });

    console.log('\n--- 8. Concurrent Acquisition and Publication ---');
    await test('8. Concurrent acquisition and publication: No stale publication commits after transfer', async () => {
      const lockKey = `lock:pg:concurrent:${Date.now()}`;
      const cacheKey = `cache:pg:concurrent:${Date.now()}`;
      const owner1 = `worker1_conc_${Date.now()}`;
      const owner2 = `worker2_conc_${Date.now()}`;

      const acq1 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 1);`,
        [lockKey, owner1]
      );
      const token1 = Number(acq1.rows[0].fencing_token);
      await new Promise(r => setTimeout(r, 1200));

      const w2Client = new Client(DB_CONFIG);
      await w2Client.connect();
      try {
        await w2Client.query('SET ROLE service_role;');

        const [resAcq2, resWrite1] = await Promise.all([
          w2Client.query(`SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 5);`, [lockKey, owner2]),
          client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
            cacheKey, '1008', 'fix-1008', JSON.stringify({ version: 'stale_w1' }), token1, lockKey, owner1
          ])
        ]);

        assert.equal(resWrite1.rows[0].written, false, 'Expired write must be rejected');
        assert.equal(resAcq2.rows[0].acquired, true, 'Worker 2 must acquire lock');
      } finally {
        await w2Client.end();
        await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
      }
    });

    console.log('\n--- 9. Independent Fixtures Non-Interference ---');
    await test('9. Independent fixtures: Concurrent publications for different fixtures do not block or interfere', async () => {
      const lock1 = `lock:pg:fix1:${Date.now()}`;
      const cache1 = `cache:pg:fix1:${Date.now()}`;
      const lock2 = `lock:pg:fix2:${Date.now()}`;
      const cache2 = `cache:pg:fix2:${Date.now()}`;
      const owner1 = `w1_fix_${Date.now()}`;
      const owner2 = `w2_fix_${Date.now()}`;

      const [acq1, acq2] = await Promise.all([
        client.query(`SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 5);`, [lock1, owner1]),
        client.query(`SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 5);`, [lock2, owner2]),
      ]);

      const token1 = Number(acq1.rows[0].fencing_token);
      const token2 = Number(acq2.rows[0].fencing_token);

      const [w1, w2] = await Promise.all([
        client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
          cache1, 'fix-1', 'key-1', JSON.stringify({ fixture: 1 }), token1, lock1, owner1
        ]),
        client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
          cache2, 'fix-2', 'key-2', JSON.stringify({ fixture: 2 }), token2, lock2, owner2
        ]),
      ]);

      assert.equal(w1.rows[0].written, true);
      assert.equal(w2.rows[0].written, true);

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key IN ($1, $2);', [lock1, lock2]);
      await client.query('DELETE FROM public.api_catalog_cache WHERE cache_key IN ($1, $2);', [cache1, cache2]);
    });

    console.log('\n--- 10. Duplicate Publication Idempotency ---');
    await test('10. Duplicate publication: Idempotent within valid lease; rejected after release', async () => {
      const lockKey = `lock:pg:dup:${Date.now()}`;
      const cacheKey = `cache:pg:dup:${Date.now()}`;
      const owner = `w_dup_${Date.now()}`;

      const acq = await client.query(`SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 5);`, [lockKey, owner]);
      const token = Number(acq.rows[0].fencing_token);

      // Write 1
      const w1 = await client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
        cacheKey, '1010', 'fix-1010', JSON.stringify({ seq: 1 }), token, lockKey, owner
      ]);
      assert.equal(w1.rows[0].written, true);

      // Duplicate Write 2 within active lease
      const w2 = await client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
        cacheKey, '1010', 'fix-1010', JSON.stringify({ seq: 2 }), token, lockKey, owner
      ]);
      assert.equal(w2.rows[0].written, true, 'Duplicate write under valid lease must succeed');

      // Release lock with matching token
      await client.query(`SELECT public.release_distributed_lock($1, $2, $3);`, [lockKey, owner, token]);

      // Write 3 after release
      const w3 = await client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
        cacheKey, '1010', 'fix-1010', JSON.stringify({ seq: 3 }), token, lockKey, owner
      ]);
      assert.equal(w3.rows[0].written, false, 'Write after lock release must be rejected');

      await client.query('DELETE FROM public.api_catalog_cache WHERE cache_key = $1;', [cacheKey]);
    });

    console.log('\n--- 11. Cache Fencing Monotonicity ---');
    await test('11. Cache fencing monotonicity: Lower fencing token cannot overwrite higher fencing token', async () => {
      const lockKey = `lock:pg:monotonic:${Date.now()}`;
      const cacheKey = `cache:pg:monotonic:${Date.now()}`;
      const owner = `w_mono_${Date.now()}`;

      // Acquire lock with token
      const acq = await client.query(`SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`, [lockKey, owner]);
      const tokenHigh = Number(acq.rows[0].fencing_token);

      // Write with tokenHigh
      const wHigh = await client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
        cacheKey, '1011', 'fix-1011', JSON.stringify({ v: 'high' }), tokenHigh, lockKey, owner
      ]);
      assert.equal(wHigh.rows[0].written, true);

      // Attempt lower token write (e.g. tokenHigh - 1)
      const tokenLow = tokenHigh - 1;
      const wLow = await client.query(`SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, $5, $6, $7) AS written;`, [
        cacheKey, '1011', 'fix-1011', JSON.stringify({ v: 'low' }), tokenLow, lockKey, owner
      ]);
      assert.equal(wLow.rows[0].written, false, 'Write with lower token must be rejected by cache fencing');

      // Verify cache payload is still 'high'
      const checkRes = await client.query(`SELECT payload FROM public.api_catalog_cache WHERE cache_key = $1;`, [cacheKey]);
      assert.deepEqual(checkRes.rows[0].payload, { v: 'high' });

      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [lockKey]);
      await client.query('DELETE FROM public.api_catalog_cache WHERE cache_key = $1;', [cacheKey]);
    });

    console.log('\n--- 12. Global Budget Reservation Concurrency ---');
    await test('12. Global budget reservation atomicity: Concurrent workers cannot exceed capacity', async () => {
      const provider = `test_provider_${Date.now()}`;
      const capacity = 5;
      const windowSec = 60;
      const workerCount = 10;

      await client.query('DELETE FROM public.api_upstream_budget_reservations WHERE provider = $1;', [provider]);

      const workers = Array.from({ length: workerCount }, () => new Client(DB_CONFIG));
      await Promise.all(workers.map(w => w.connect()));
      try {
        const results = await Promise.all(
          workers.map(async (w) => {
            await w.query('SET ROLE service_role;');
            const res = await w.query(
              `SELECT allowed, reason, retry_after, current_count FROM public.acquire_upstream_budget_lease($1, $2, $3);`,
              [provider, capacity, windowSec]
            );
            return res.rows[0].allowed === true;
          })
        );

        const allowedCount = results.filter(Boolean).length;
        assert.equal(allowedCount, capacity, `Expected exactly ${capacity} allowed reservations out of ${workerCount}`);

        const countRes = await client.query(
          'SELECT COUNT(*)::int AS count FROM public.api_upstream_budget_reservations WHERE provider = $1;',
          [provider]
        );
        assert.equal(countRes.rows[0].count, capacity);
      } finally {
        await Promise.all(workers.map(w => w.end()));
        await client.query('DELETE FROM public.api_upstream_budget_reservations WHERE provider = $1;', [provider]);
      }
    });

    console.log('\n--- 13. Cooldown Behaviour and Storage ---');
    await test('13. Cooldown behaviour: Active cooldown prevents budget reservation; stored in api_upstream_status', async () => {
      const provider = `test_cd_${Date.now()}`;

      // Set cooldown for 2 seconds
      const cdRes = await client.query(
        `SELECT public.set_upstream_cooldown($1, 2, 'Simulated Upstream 503');`,
        [provider]
      );
      assert.ok(cdRes.rows[0].set_upstream_cooldown !== null);

      // Verify stored in api_upstream_status table
      const statusRes = await client.query(
        `SELECT provider, cooldown_until > clock_timestamp() AS in_cooldown, consecutive_failures FROM public.api_upstream_status WHERE provider = $1;`,
        [provider]
      );
      assert.equal(statusRes.rows.length, 1);
      assert.equal(statusRes.rows[0].in_cooldown, true);

      // Attempt budget reservation -> Must be rejected due to COOLDOWN
      const budgetRes = await client.query(
        `SELECT allowed, reason, retry_after FROM public.acquire_upstream_budget_lease($1, 100, 60);`,
        [provider]
      );
      assert.equal(budgetRes.rows[0].allowed, false);
      assert.equal(budgetRes.rows[0].reason, 'COOLDOWN');
      assert.ok(budgetRes.rows[0].retry_after > 0);

      // Clean up
      await client.query('DELETE FROM public.api_upstream_status WHERE provider = $1;', [provider]);
    });

    console.log('\n--- 14. Cleanup Behaviour ---');
    await test('14. Cleanup behaviour: cleanup_expired_coordination_data purges expired records and returns count', async () => {
      const activeLock = `lock:active:${Date.now()}`;
      const expiredLock = `lock:expired:${Date.now()}`;

      // Insert active lock (expires in 10s)
      await client.query(
        `INSERT INTO public.api_distributed_locks (lock_key, owner_id, expires_at, fencing_token)
         VALUES ($1, 'owner_act', clock_timestamp() + interval '10 seconds', 1);`,
        [activeLock]
      );

      // Insert expired lock (expired 10s ago)
      await client.query(
        `INSERT INTO public.api_distributed_locks (lock_key, owner_id, expires_at, fencing_token)
         VALUES ($1, 'owner_exp', clock_timestamp() - interval '10 seconds', 2);`,
        [expiredLock]
      );

      // Run cleanup function
      const cleanupRes = await client.query(`SELECT deleted_reservations, deleted_locks, deleted_cache_entries FROM public.cleanup_expired_coordination_data();`);
      assert.ok(cleanupRes.rows.length === 1);
      assert.ok(cleanupRes.rows[0].deleted_locks >= 1, 'Must delete at least 1 expired lock');

      // Verify active lock survived, expired was purged
      const activeCheck = await client.query(`SELECT lock_key FROM public.api_distributed_locks WHERE lock_key = $1;`, [activeLock]);
      const expiredCheck = await client.query(`SELECT lock_key FROM public.api_distributed_locks WHERE lock_key = $1;`, [expiredLock]);

      assert.equal(activeCheck.rows.length, 1, 'Active lock must survive cleanup');
      assert.equal(expiredCheck.rows.length, 0, 'Expired lock must be deleted by cleanup');

      // Clean up active lock
      await client.query('DELETE FROM public.api_distributed_locks WHERE lock_key = $1;', [activeLock]);
    });

    console.log('\n--- 15. Transaction Rollback Safety ---');
    await test('15. Transaction rollback safety: Aborted transaction leaves no orphaned locks or dirty state', async () => {
      const lockKey = `lock:test:rollback:${Date.now()}`;
      const txClient = new Client(DB_CONFIG);
      await txClient.connect();
      try {
        await txClient.query('SET ROLE service_role;');
        await txClient.query('BEGIN;');
        await txClient.query(
          `INSERT INTO public.api_distributed_locks (lock_key, owner_id, expires_at, fencing_token)
           VALUES ($1, 'tx_owner', clock_timestamp() + interval '60 seconds', 999);`,
          [lockKey]
        );
        // Rollback
        await txClient.query('ROLLBACK;');
      } finally {
        await txClient.end();
      }

      // Check main client: row must not exist
      const checkRes = await client.query(
        `SELECT lock_key FROM public.api_distributed_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      assert.equal(checkRes.rows.length, 0, 'Lock inserted in rolled back transaction must not exist');
    });

    console.log('\n--- 16. Negative Ownership: Null Lock Key Rejected ---');
    await test('16. Negative ownership: Null or empty lock key is unconditionally rejected', async () => {
      const cacheKey = `cache:pg:null_lock:${Date.now()}`;
      const writeNull = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 100, NULL, 'owner_test') AS written;`,
        [cacheKey, '1016', 'fix-1016', JSON.stringify({ ok: true })]
      );
      assert.equal(writeNull.rows[0].written, false, 'Null lock key must be rejected');

      const writeEmpty = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 100, '   ', 'owner_test') AS written;`,
        [cacheKey, '1016', 'fix-1016', JSON.stringify({ ok: true })]
      );
      assert.equal(writeEmpty.rows[0].written, false, 'Empty lock key must be rejected');
    });

    console.log('\n--- 17. Negative Ownership: Null Owner ID Rejected ---');
    await test('17. Negative ownership: Null or empty owner ID is unconditionally rejected', async () => {
      const lockKey = `lock:pg:null_owner:${Date.now()}`;
      const cacheKey = `cache:pg:null_owner:${Date.now()}`;

      const writeNull = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 100, $5, NULL) AS written;`,
        [cacheKey, '1017', 'fix-1017', JSON.stringify({ ok: true }), lockKey]
      );
      assert.equal(writeNull.rows[0].written, false, 'Null owner ID must be rejected');

      const writeEmpty = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 100, $5, '   ') AS written;`,
        [cacheKey, '1017', 'fix-1017', JSON.stringify({ ok: true }), lockKey]
      );
      assert.equal(writeEmpty.rows[0].written, false, 'Empty owner ID must be rejected');
    });

    console.log('\n--- 18. Negative Ownership: Null Fencing Token Rejected ---');
    await test('18. Negative ownership: Null fencing token is unconditionally rejected', async () => {
      const lockKey = `lock:pg:null_token:${Date.now()}`;
      const cacheKey = `cache:pg:null_token:${Date.now()}`;

      const writeNull = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, NULL, $5, 'owner_test') AS written;`,
        [cacheKey, '1018', 'fix-1018', JSON.stringify({ ok: true }), lockKey]
      );
      assert.equal(writeNull.rows[0].written, false, 'Null fencing token must be rejected');
    });

    console.log('\n--- 19. Negative Ownership: Zero or Invalid Fencing Token Rejected ---');
    await test('19. Negative ownership: Zero or negative fencing token is unconditionally rejected', async () => {
      const lockKey = `lock:pg:zero_token:${Date.now()}`;
      const cacheKey = `cache:pg:zero_token:${Date.now()}`;

      const writeZero = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, 0, $5, 'owner_test') AS written;`,
        [cacheKey, '1019', 'fix-1019', JSON.stringify({ ok: true }), lockKey]
      );
      assert.equal(writeZero.rows[0].written, false, 'Zero fencing token must be rejected');

      const writeNeg = await client.query(
        `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB, 15, 60, NULL, -10, $5, 'owner_test') AS written;`,
        [cacheKey, '1019', 'fix-1019', JSON.stringify({ ok: true }), lockKey]
      );
      assert.equal(writeNeg.rows[0].written, false, 'Negative fencing token must be rejected');
    });

    console.log('\n--- 20. Negative Ownership: Omitted Ownership Arguments Fail Function Resolution ---');
    await test('20. Negative ownership: Omitted ownership arguments fail function resolution', async () => {
      const cacheKey = `cache:pg:omitted:${Date.now()}`;
      let resolutionFailed = false;
      try {
        await client.query(
          `SELECT public.set_catalog_cache_entry($1, $2, $3, $4::JSONB);`,
          [cacheKey, '1020', 'fix-1020', JSON.stringify({ ok: true })]
        );
      } catch (err: any) {
        resolutionFailed = err.message.includes('does not exist') || err.code === '42883';
      }
      assert.equal(resolutionFailed, true, 'Calling set_catalog_cache_entry without required arguments must fail resolution');
    });

    console.log('\n--- 21. Token-Fenced Release: Stale Release Token Rejected ---');
    await test('21. Token-fenced release: Stale release token cannot delete active lease', async () => {
      const lockKey = `lock:pg:stale_release:${Date.now()}`;
      const owner = `worker_stale_rel_${Date.now()}`;

      const acq = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner]
      );
      const token = Number(acq.rows[0].fencing_token);

      const relStale = await client.query(
        `SELECT public.release_distributed_lock($1, $2, $3) AS released;`,
        [lockKey, owner, token + 999]
      );
      assert.equal(relStale.rows[0].released, false, 'Release with stale token must return false');

      const checkRes = await client.query(
        `SELECT lock_key FROM public.api_distributed_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      assert.equal(checkRes.rows.length, 1, 'Lock must remain active after stale release attempt');

      await client.query(`SELECT public.release_distributed_lock($1, $2, $3);`, [lockKey, owner, token]);
    });

    console.log('\n--- 22. Token-Fenced Release: Correct Release Token Succeeds ---');
    await test('22. Token-fenced release: Correct release token successfully deletes lease', async () => {
      const lockKey = `lock:pg:valid_release:${Date.now()}`;
      const owner = `worker_valid_rel_${Date.now()}`;

      const acq = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, owner]
      );
      const token = Number(acq.rows[0].fencing_token);

      const rel = await client.query(
        `SELECT public.release_distributed_lock($1, $2, $3) AS released;`,
        [lockKey, owner, token]
      );
      assert.equal(rel.rows[0].released, true, 'Release with correct token must succeed');

      const checkRes = await client.query(
        `SELECT lock_key FROM public.api_distributed_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      assert.equal(checkRes.rows.length, 0, 'Lock must be deleted after valid release');
    });

    console.log('\n--- 23. Token-Fenced Release: Overdue Worker Re-Acquisition Protection ---');
    await test('23. Token-fenced release: Overdue worker cannot release newer lease held by same owner identity', async () => {
      const lockKey = `lock:pg:reused_owner:${Date.now()}`;
      const sharedOwner = `worker_reused_${Date.now()}`;

      const acq1 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 1);`,
        [lockKey, sharedOwner]
      );
      const token1 = Number(acq1.rows[0].fencing_token);

      await new Promise(r => setTimeout(r, 1200));

      const acq2 = await client.query(
        `SELECT acquired, fencing_token FROM public.acquire_distributed_lock($1, $2, 10);`,
        [lockKey, sharedOwner]
      );
      assert.equal(acq2.rows[0].acquired, true);
      const token2 = Number(acq2.rows[0].fencing_token);
      assert.ok(token2 > token1, 'Re-acquired lease must have newer fencing token');

      const relOld = await client.query(
        `SELECT public.release_distributed_lock($1, $2, $3) AS released;`,
        [lockKey, sharedOwner, token1]
      );
      assert.equal(relOld.rows[0].released, false, 'Overdue release with stale token must be rejected');

      const checkLock = await client.query(
        `SELECT fencing_token FROM public.api_distributed_locks WHERE lock_key = $1;`,
        [lockKey]
      );
      assert.equal(checkLock.rows.length, 1);
      assert.equal(Number(checkLock.rows[0].fencing_token), token2, 'Newer lease must remain active');

      await client.query(`SELECT public.release_distributed_lock($1, $2, $3);`, [lockKey, sharedOwner, token2]);
    });

    console.log('\n================================================================================');
    console.log(`--- PostgreSQL Suite Results: ${passed} passed, ${failed} failed, ${skipped} skipped ---`);
    console.log('================================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (connected) {
      await client.end();
    }
  }
}

runPostgresCoordinationSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
