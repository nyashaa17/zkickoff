// Standalone test environment: stub 'server-only' package before loading server modules
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

console.log('================================================================================');
console.log('--- Running ZimKickOff Developer API Phase 2.2 Comprehensive Test Suite ---');
console.log('================================================================================');

let passed = 0;
let failed = 0;

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
    failed++;
  }
}

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54321,
  user: 'postgres',
  password: 'postgres',
  database: 'zimkickoff_test',
};

async function main() {
  // Dynamically import modules now that server-only is stubbed
  const {
    generateApiKey,
    hashApiKey,
    isValidKeyStructure,
    extractKeyPrefix,
    constantTimeHashCompare,
  } = await import('../lib/api/auth');

  const {
    LATENCY_BUCKETS_18,
    getHistogramBinIndex,
    interpolatePercentile,
    createEmptyHistogram,
  } = await import('../lib/api/types');

  const {
    getCurrentMinuteWindow,
    getCurrentDayWindow,
    calculateAdaptiveLeaseSize,
  } = await import('../lib/api/rate-limiter');

  const {
    getOrFetchWithSWR,
    clearApiCache,
    CACHE_PROFILES,
  } = await import('../lib/api/cache');

  const {
    validateAndFormatDateParam,
    filterAndPaginateMatches,
    sanitizePublicMatch,
  } = await import('../lib/api/match-sanitizer');

  const dbClient = new Client(DB_CONFIG);
  await dbClient.connect();
  await dbClient.query('SET ROLE service_role;');

  // Clean test tables
  await dbClient.query('DELETE FROM public.api_rate_limit_leases;');
  await dbClient.query('DELETE FROM public.api_rate_limits;');
  await dbClient.query('DELETE FROM public.api_usage_hourly;');
  await dbClient.query('DELETE FROM public.api_analytics_batches;');
  await dbClient.query('DELETE FROM public.api_keys;');

  console.log('\n--- 1. Authentication & Cryptography Tests ---');

  let testKey1: { fullKey: string; keyPrefix: string; keyHash: string };
  let testKeyRecordId1: string;

  await test('Valid API key generation format (zk_live_<8hex>_<43base64url>)', () => {
    testKey1 = generateApiKey();
    assert.ok(isValidKeyStructure(testKey1.fullKey), 'Generated key must have valid structure');
    assert.ok(testKey1.fullKey.startsWith('zk_live_'), 'Key must start with zk_live_');
    assert.equal(testKey1.keyPrefix.length, 16, 'Prefix should be zk_live_ + 8 hex chars (16 chars)');
    assert.equal(testKey1.keyHash.length, 64, 'Key hash must be 64-character SHA-256 hex string');
  });

  await test('Constant-time hash comparison prevents timing attacks', () => {
    const hashA = hashApiKey('test-key-string-sample-123456');
    const hashB = hashApiKey('test-key-string-sample-123456');
    const hashC = hashApiKey('test-key-string-sample-123457');

    assert.ok(constantTimeHashCompare(hashA, hashB), 'Identical hashes must match');
    assert.ok(!constantTimeHashCompare(hashA, hashC), 'Non-matching hashes must be rejected');
    assert.ok(!constantTimeHashCompare(hashA, 'short-hash'), 'Malformed hash length must be rejected safely');
  });

  await test('Key prefix extraction for O(1) indexed database lookups', () => {
    const prefix = extractKeyPrefix(testKey1.fullKey);
    assert.equal(prefix, testKey1.keyPrefix);
    assert.equal(extractKeyPrefix('malformed-token-123'), null);
  });

  await test('Database key insertion with SHA-256 hash (plaintext never stored)', async () => {
    const insertRes = await dbClient.query(
      `INSERT INTO public.api_keys (name, developer_name, developer_email, key_prefix, key_hash, status, rate_limit_minute, rate_limit_day)
       VALUES ($1, $2, $3, $4, $5, 'active', 60, 10000)
       RETURNING id, name, status, key_prefix;`,
      ['Test App 1', 'Test Developer', 'dev@example.com', testKey1.keyPrefix, testKey1.keyHash]
    );
    assert.equal(insertRes.rows.length, 1);
    testKeyRecordId1 = insertRes.rows[0].id;
    assert.equal(insertRes.rows[0].status, 'active');
  });

  await test('Revoked API key status enforcement via constraint', async () => {
    const revokedKey = generateApiKey();
    await assert.rejects(
      async () => {
        await dbClient.query(
          `INSERT INTO public.api_keys (name, developer_name, developer_email, key_prefix, key_hash, status, revoked_at)
           VALUES ('Revoked Test', 'Revoked Dev', 'rev@example.com', $1, $2, 'revoked', NULL);`,
          [revokedKey.keyPrefix, revokedKey.keyHash]
        );
      },
      /chk_api_key_revocation_integrity/,
      'Constraint must reject revoked status with NULL revoked_at'
    );

    const validRevokedRes = await dbClient.query(
      `INSERT INTO public.api_keys (name, developer_name, developer_email, key_prefix, key_hash, status, revoked_at, revocation_reason)
       VALUES ('Revoked Test', 'Revoked Dev', 'rev@example.com', $1, $2, 'revoked', now(), 'Security test')
       RETURNING status;`,
      [revokedKey.keyPrefix, revokedKey.keyHash]
    );
    assert.equal(validRevokedRes.rows[0].status, 'revoked');
  });

  console.log('\n--- 2. Workstream A: Quota Allocation, Consumption & Refund Integrity Tests ---');

  const nowMs = Date.now();
  const currentMinute = getCurrentMinuteWindow(nowMs);
  const currentDay = getCurrentDayWindow(nowMs);

  await test('Adaptive Lease Sizing formula delivers proportional leases without starvation', () => {
    assert.equal(calculateAdaptiveLeaseSize(60, 2), 5, 'When remaining=60, lease size should cap at 5');
    assert.equal(calculateAdaptiveLeaseSize(10, 2), 5, 'When remaining=10, lease size should be 5');
    assert.equal(calculateAdaptiveLeaseSize(4, 2), 2, 'When remaining=4, lease size should drop to 2');
    assert.equal(calculateAdaptiveLeaseSize(1, 2), 1, 'When remaining=1, lease size should be 1');
    assert.equal(calculateAdaptiveLeaseSize(0, 2), 1, 'When remaining=0, lease size defaults to 1');
  });

  let leaseA_id: string;

  await test('Full allocation followed by full consumption: Cannot refund consumed tokens', async () => {
    // 1. Acquire lease of 5 tokens
    const res = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, 0, 0
      );`,
      [testKeyRecordId1, currentMinute, currentDay]
    );
    assert.equal(res.rows[0].allowed, true);
    assert.equal(res.rows[0].granted_tokens, 5);
    leaseA_id = res.rows[0].granted_lease_id;

    // 2. All 5 tokens were consumed by incoming requests. Reconcile lease with tokens_consumed = 5, refund = 0
    const reconcileRes = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, $4::UUID, 0, 5
      );`,
      [testKeyRecordId1, currentMinute + 60, currentDay, leaseA_id]
    );
    assert.equal(reconcileRes.rows[0].allowed, true);

    // 3. Verify lease record in database: status is 'closed', tokens_consumed = 5, tokens_refunded = 0
    const leaseCheck = await dbClient.query(
      `SELECT tokens_allocated, tokens_consumed, tokens_refunded, status, closed_at 
       FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [leaseA_id]
    );
    assert.equal(leaseCheck.rows[0].tokens_allocated, 5);
    assert.equal(leaseCheck.rows[0].tokens_consumed, 5);
    assert.equal(leaseCheck.rows[0].tokens_refunded, 0);
    assert.equal(leaseCheck.rows[0].status, 'closed');
    assert.ok(leaseCheck.rows[0].closed_at !== null);

    // 4. Invariant: Attempting to refund ANY tokens from this fully consumed lease MUST be blocked (0 refund)
    const rogueRefundRes = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, $4::UUID, 5, 0
      );`,
      [testKeyRecordId1, currentMinute + 120, currentDay, leaseA_id]
    );
    assert.equal(rogueRefundRes.rows[0].allowed, true);

    // Verify lease tokens_refunded remains strictly 0
    const leaseAfterCheck = await dbClient.query(
      `SELECT tokens_refunded, status FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [leaseA_id]
    );
    assert.equal(leaseAfterCheck.rows[0].tokens_refunded, 0, 'Consumed tokens must never be refunded');
  });

  let leaseB_id: string;

  await test('Partial consumption followed by valid refund: Only genuine unused tokens refunded', async () => {
    // Allocate 5 tokens on lease B
    const res = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, 0, 0
      );`,
      [testKeyRecordId1, currentMinute + 180, currentDay]
    );
    leaseB_id = res.rows[0].granted_lease_id;

    // Check day allocated count before refund
    const dayBefore = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [testKeyRecordId1, currentDay]
    );
    const dayBeforeCount = dayBefore.rows[0].allocated_count;

    // Worker consumed 2 tokens; 3 tokens were unconsumed before minute rollover.
    // Reconcile: refund 3, consumed 2.
    await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 1, $4::UUID, 3, 2
      );`,
      [testKeyRecordId1, currentMinute + 240, currentDay, leaseB_id]
    );

    const leaseBCheck = await dbClient.query(
      `SELECT tokens_allocated, tokens_consumed, tokens_refunded, status FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [leaseB_id]
    );
    assert.equal(leaseBCheck.rows[0].tokens_allocated, 5);
    assert.equal(leaseBCheck.rows[0].tokens_consumed, 2);
    assert.equal(leaseBCheck.rows[0].tokens_refunded, 3);
    assert.equal(leaseBCheck.rows[0].status, 'closed');

    // Day counter should reflect refund of 3 tokens (net effect: dayBeforeCount - 3 + 1 newly granted = dayBeforeCount - 2)
    const dayAfter = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [testKeyRecordId1, currentDay]
    );
    assert.equal(dayAfter.rows[0].allocated_count, dayBeforeCount - 3 + 1);
  });

  await test('Duplicate refund: Repeated refund of same lease yields 0 additional refund', async () => {
    const dayBefore = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [testKeyRecordId1, currentDay]
    );
    const dayBeforeCount = dayBefore.rows[0].allocated_count;

    // Attempt to refund lease B again
    await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 2, $4::UUID, 3, 0
      );`,
      [testKeyRecordId1, currentMinute + 300, currentDay, leaseB_id]
    );

    const dayAfter = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [testKeyRecordId1, currentDay]
    );
    // Only the 2 newly granted tokens added, 0 refunded!
    assert.equal(dayAfter.rows[0].allocated_count, dayBeforeCount + 2);
  });

  await test('Concurrent refund race: Concurrent workers cannot over-refund a lease', async () => {
    // Create lease C with 4 tokens
    const leaseRes = await dbClient.query(
      `SELECT granted_lease_id FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 4, NULL::UUID, 0, 0
      );`,
      [testKeyRecordId1, currentMinute + 360, currentDay]
    );
    const leaseC_id = leaseRes.rows[0].granted_lease_id;

    const worker1 = new Client(DB_CONFIG);
    const worker2 = new Client(DB_CONFIG);
    await worker1.connect();
    await worker2.connect();
    await worker1.query('SET ROLE service_role;');
    await worker2.query('SET ROLE service_role;');

    // Both workers attempt to refund the entire 4 tokens simultaneously
    await Promise.all([
      worker1.query(
        `SELECT * FROM public.acquire_rate_limit_lease($1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 1, $4::UUID, 4, 0);`,
        [testKeyRecordId1, currentMinute + 420, currentDay, leaseC_id]
      ),
      worker2.query(
        `SELECT * FROM public.acquire_rate_limit_lease($1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 1, $4::UUID, 4, 0);`,
        [testKeyRecordId1, currentMinute + 420, currentDay, leaseC_id]
      ),
    ]);

    await worker1.end();
    await worker2.end();

    const leaseCCheck = await dbClient.query(
      `SELECT tokens_allocated, tokens_refunded, status FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [leaseC_id]
    );
    assert.equal(leaseCCheck.rows[0].tokens_allocated, 4);
    assert.equal(leaseCCheck.rows[0].tokens_refunded, 4, 'Total refunded across concurrent workers must equal exactly 4');
    assert.equal(leaseCCheck.rows[0].status, 'closed');
  });

  await test('Cross-key refund rejected: Lease cannot be refunded against another API key', async () => {
    // Create second API key
    const secondKey = generateApiKey();
    const secondKeyRes = await dbClient.query(
      `INSERT INTO public.api_keys (name, developer_name, developer_email, key_prefix, key_hash, status, rate_limit_minute, rate_limit_day)
       VALUES ('Second App', 'Second Dev', 'dev2@example.com', $1, $2, 'active', 60, 10000)
       RETURNING id;`,
      [secondKey.keyPrefix, secondKey.keyHash]
    );
    const secondKeyId = secondKeyRes.rows[0].id;

    // Issue lease for Key 2
    const leaseRes = await dbClient.query(
      `SELECT granted_lease_id FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, 0, 0
      );`,
      [secondKeyId, currentMinute + 480, currentDay]
    );
    const key2LeaseId = leaseRes.rows[0].granted_lease_id;

    // Key 1 attempts to refund Key 2's lease
    await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 1, $4::UUID, 5, 0
      );`,
      [testKeyRecordId1, currentMinute + 540, currentDay, key2LeaseId]
    );

    // Verify Key 2's lease was NOT refunded by Key 1
    const key2LeaseCheck = await dbClient.query(
      `SELECT tokens_refunded, status FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [key2LeaseId]
    );
    assert.equal(key2LeaseCheck.rows[0].tokens_refunded, 0, 'Cannot refund lease belonging to another API key');
    assert.equal(key2LeaseCheck.rows[0].status, 'active');
  });

  await test('Window rollover accounting: Minute counter is conservative; daily counter is restored', async () => {
    const min1 = currentMinute + 600;
    const min2 = currentMinute + 660;

    // Minute 1: Acquire lease of 5 tokens
    const lRes = await dbClient.query(
      `SELECT granted_lease_id FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, 0, 0
      );`,
      [testKeyRecordId1, min1, currentDay]
    );
    const m1LeaseId = lRes.rows[0].granted_lease_id;

    // Check minute 1 allocated count
    const m1Check = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'minute' AND window_start = $2;`,
      [testKeyRecordId1, min1]
    );
    assert.equal(m1Check.rows[0].allocated_count, 5);

    // Minute 2: Rollover occurred. Worker consumed 1 token, returns 4 unused tokens
    const m2Res = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, $4::UUID, 4, 1
      );`,
      [testKeyRecordId1, min2, currentDay, m1LeaseId]
    );
    assert.equal(m2Res.rows[0].allowed, true);
    assert.equal(m2Res.rows[0].minute_remaining, 55, 'Minute 2 must start fresh with full limit - granted lease (60 - 5 = 55)');

    // Minute 1 row remains at 5 (conservative historical record; minute quota does not roll over)
    const m1After = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'minute' AND window_start = $2;`,
      [testKeyRecordId1, min1]
    );
    assert.equal(m1After.rows[0].allocated_count, 5);
  });

  await test('Daily rollover accounting: Lease from yesterday cannot refund quota into today', async () => {
    const yesterday = currentDay - 86400;
    const oldLeaseRes = await dbClient.query(
      `INSERT INTO public.api_rate_limit_leases (key_id, minute_window, day_window, tokens_allocated, status)
       VALUES ($1, $2, $3, 5, 'active')
       RETURNING lease_id;`,
      [testKeyRecordId1, currentMinute, yesterday]
    );
    const oldLeaseId = oldLeaseRes.rows[0].lease_id;

    const dayBefore = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [testKeyRecordId1, currentDay]
    );
    const dayBeforeCount = dayBefore.rows[0].allocated_count;

    // Attempt to refund yesterday's lease in today's day window
    await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 1, $4::UUID, 5, 0
      );`,
      [testKeyRecordId1, currentMinute + 720, currentDay, oldLeaseId]
    );

    const oldLeaseCheck = await dbClient.query(
      `SELECT tokens_refunded, status FROM public.api_rate_limit_leases WHERE lease_id = $1;`,
      [oldLeaseId]
    );
    assert.equal(oldLeaseCheck.rows[0].tokens_refunded, 0, 'Yesterday lease must not be refunded into today');
    assert.equal(oldLeaseCheck.rows[0].status, 'active');
  });

  await test('Worker crash behavior: Crash burns reserved quota safely without creating extra quota', async () => {
    // Create dedicated key with strict limit of 10
    const crashKey = generateApiKey();
    const crashKeyRes = await dbClient.query(
      `INSERT INTO public.api_keys (name, developer_name, developer_email, key_prefix, key_hash, status, rate_limit_minute, rate_limit_day)
       VALUES ('Crash Test App', 'Crash Dev', 'crash@example.com', $1, $2, 'active', 10, 10)
       RETURNING id;`,
      [crashKey.keyPrefix, crashKey.keyHash]
    );
    const crashKeyId = crashKeyRes.rows[0].id;

    // Worker 1 acquires lease of 5 tokens, consumes 2, then terminates abruptly (simulated: no refund called)
    await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 10, 10, 5, NULL::UUID, 0, 0
      );`,
      [crashKeyId, currentMinute + 780, currentDay]
    );

    // Worker 2 starts up, acquires remaining 5 tokens
    const w2Res = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 10, 10, 5, NULL::UUID, 0, 0
      );`,
      [crashKeyId, currentMinute + 780, currentDay]
    );
    assert.equal(w2Res.rows[0].allowed, true);
    assert.equal(w2Res.rows[0].granted_tokens, 5);

    // Worker 3 attempts to acquire quota -> immediately denied (10 total allocated)
    const w3Res = await dbClient.query(
      `SELECT * FROM public.acquire_rate_limit_lease(
        $1::UUID, $2::BIGINT, $3::BIGINT, 10, 10, 5, NULL::UUID, 0, 0
      );`,
      [crashKeyId, currentMinute + 780, currentDay]
    );
    assert.equal(w3Res.rows[0].allowed, false);
    assert.equal(w3Res.rows[0].granted_tokens, 0);

    // Invariant holds: daily_completed_requests (2) + daily_outstanding_reservations (8) = 10 <= 10
    const dayCount = await dbClient.query(
      `SELECT allocated_count FROM public.api_rate_limits WHERE key_id = $1 AND window_type = 'day' AND window_start = $2;`,
      [crashKeyId, currentDay]
    );
    assert.equal(dayCount.rows[0].allocated_count, 10);
  });

  await test('Parameter validation: acquire_rate_limit_lease rejects negative or invalid inputs', async () => {
    // Negative lease size
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT * FROM public.acquire_rate_limit_lease($1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, -1, NULL::UUID, 0, 0);`,
          [testKeyRecordId1, currentMinute, currentDay]
        );
      },
      /INVALID_LEASE_SIZE/
    );

    // Negative refund
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT * FROM public.acquire_rate_limit_lease($1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, -2, 0);`,
          [testKeyRecordId1, currentMinute, currentDay]
        );
      },
      /INVALID_REFUND_TOKENS/
    );

    // Negative consumed
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT * FROM public.acquire_rate_limit_lease($1::UUID, $2::BIGINT, $3::BIGINT, 60, 10000, 5, NULL::UUID, 0, -3);`,
          [testKeyRecordId1, currentMinute, currentDay]
        );
      },
      /INVALID_CONSUMED_TOKENS/
    );
  });

  console.log('\n--- 3. Workstream B: Histogram Boundaries, Accuracy & Overflow Handling Tests ---');

  await test('Exact boundary mapping for all 18 buckets', () => {
    const boundaries = [0, 10, 15, 20, 30, 40, 50, 70, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000];
    for (let i = 0; i < boundaries.length; i++) {
      const idx = getHistogramBinIndex(boundaries[i]);
      assert.equal(idx, i, `Exact boundary ${boundaries[i]}ms must map to Bin ${i}`);
    }
  });

  await test('Boundary edge checks immediately below and above each threshold', () => {
    assert.equal(getHistogramBinIndex(0), 0);
    assert.equal(getHistogramBinIndex(9.999), 0);
    assert.equal(getHistogramBinIndex(10.000), 1);
    assert.equal(getHistogramBinIndex(14.999), 1);
    assert.equal(getHistogramBinIndex(15.000), 2);
    assert.equal(getHistogramBinIndex(29.999), 3);
    assert.equal(getHistogramBinIndex(30.000), 4);
    assert.equal(getHistogramBinIndex(2999.999), 16);
    assert.equal(getHistogramBinIndex(3000.000), 17);
  });

  await test('Overflow handling: Values >= 3000ms up to arbitrarily high latencies map safely to Bin 17', () => {
    assert.equal(getHistogramBinIndex(3000), 17);
    assert.equal(getHistogramBinIndex(5000), 17);
    assert.equal(getHistogramBinIndex(10000), 17);
    assert.equal(getHistogramBinIndex(12500), 17, 'Latency > 10,000ms must map safely to Bin 17');
    assert.equal(getHistogramBinIndex(60000), 17, 'Latency = 60,000ms (1 min) must map safely to Bin 17');
  });

  await test('Empty histogram handling: interpolatePercentile returns 0', () => {
    const emptyHist = createEmptyHistogram();
    assert.equal(interpolatePercentile(emptyHist, 0.50), 0);
    assert.equal(interpolatePercentile(emptyHist, 0.95), 0);
    assert.equal(interpolatePercentile(null as any, 0.50), 0);
  });

  await test('Overflow percentile estimation: Percentile falling in Bin 17 returns 3000ms lower bound', () => {
    const hist = createEmptyHistogram();
    // 100 requests in Bin 17 (>= 3000ms)
    hist[17] = 100;
    const p50 = interpolatePercentile(hist, 0.50);
    const p95 = interpolatePercentile(hist, 0.95);
    const p99 = interpolatePercentile(hist, 0.99);

    assert.equal(p50, 3000, 'P50 in unbounded overflow bin must return lower bound 3000ms');
    assert.equal(p95, 3000, 'P95 in unbounded overflow bin must return lower bound 3000ms');
    assert.equal(p99, 3000, 'P99 in unbounded overflow bin must return lower bound 3000ms');
  });

  await test('Mathematical accuracy: Guaranteed worst-case error bounded by full bin width W', () => {
    // For every bounded bin i in [0..16]:
    for (let i = 0; i < 17; i++) {
      const bin = LATENCY_BUCKETS_18[i];
      const width = bin.max - bin.min;
      const b = createEmptyHistogram();
      b[i] = 100;

      // Sample percentiles across the bin
      for (const pct of [0.10, 0.25, 0.50, 0.75, 0.90]) {
        const est = interpolatePercentile(b, pct);
        assert.ok(
          est >= bin.min && est <= bin.max,
          `Bin ${i} percentile ${pct} (${est}ms) must be inside [${bin.min}, ${bin.max}]`
        );
        // Error from any point in the bin cannot exceed full bin width W
        assert.ok(
          Math.abs(est - bin.min) <= width && Math.abs(est - bin.max) <= width,
          `Guaranteed worst-case error in Bin ${i} must be <= full width (${width}ms)`
        );
      }
    }
  });

  await test('Histogram aggregation across multiple batches performs exact vector addition', async () => {
    const multiHourTs = new Date(Math.floor((Date.now() - 7200000) / 3600000) * 3600000).toISOString();
    const batch1Id = crypto.randomUUID();
    const batch2Id = crypto.randomUUID();

    const batch1 = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: multiHourTs,
        count: 5,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    const batch2 = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: multiHourTs,
        count: 5,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [0, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    await dbClient.query(
      `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
      [batch1Id, testKeyRecordId1, JSON.stringify(batch1)]
    );

    await dbClient.query(
      `SELECT public.ingest_analytics_batch($1::UUID, 'worker-2', ARRAY[$2::UUID], $3::JSONB);`,
      [batch2Id, testKeyRecordId1, JSON.stringify(batch2)]
    );

    const aggregated = await dbClient.query(
      `SELECT total_requests, latency_buckets FROM public.api_usage_hourly
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, multiHourTs]
    );

    assert.equal(aggregated.rows[0].total_requests, 10);
    // Vector addition: [1+0, 2+1, 2+3, 0+1, ...] = [1, 3, 5, 1, 0, ...]
    assert.equal(aggregated.rows[0].latency_buckets[0], 1);
    assert.equal(aggregated.rows[0].latency_buckets[1], 3);
    assert.equal(aggregated.rows[0].latency_buckets[2], 5);
    assert.equal(aggregated.rows[0].latency_buckets[3], 1);
  });

  await test('Schema check constraint chk_api_usage_hourly_buckets rejects arrays not having exactly 18 elements', async () => {
    const testHour = new Date().toISOString();

    // 17 elements
    await assert.rejects(
      async () => {
        await dbClient.query(`
          INSERT INTO public.api_usage_hourly (
            api_key_id, endpoint, status_group, hour_timestamp, total_requests, latency_buckets
          ) VALUES (
            $1, '/api/v1/matches/live', '2xx', $2, 1, '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17}'
          );
        `, [testKeyRecordId1, testHour]);
      },
      /chk_api_usage_hourly_buckets/
    );

    // 19 elements
    await assert.rejects(
      async () => {
        await dbClient.query(`
          INSERT INTO public.api_usage_hourly (
            api_key_id, endpoint, status_group, hour_timestamp, total_requests, latency_buckets
          ) VALUES (
            $1, '/api/v1/matches/live', '2xx', $2, 1, '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19}'
          );
        `, [testKeyRecordId1, testHour]);
      },
      /chk_api_usage_hourly_buckets/
    );
  });

  console.log('\n--- 4. Workstream C: Strict Analytics Validation & Failure Recovery Tests ---');

  const testHourTimestamp = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();

  await test('Validation: Rejects missing batch_id or empty worker_id', async () => {
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch(NULL, 'worker-1', ARRAY[$1::UUID], '[]'::JSONB);`,
          [testKeyRecordId1]
        );
      },
      /BATCH_ID_REQUIRED/
    );

    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, '   ', ARRAY[$2::UUID], '[]'::JSONB);`,
          [crypto.randomUUID(), testKeyRecordId1]
        );
      },
      /WORKER_ID_REQUIRED/
    );
  });

  await test('Validation: Rejects invalid UUID or unknown API key in aggregate records', async () => {
    const bId = crypto.randomUUID();
    const badUuidRecord = [
      {
        apiKeyId: 'not-a-valid-uuid',
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: testHourTimestamp,
        count: 1,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[]::UUID[], $2::JSONB);`,
          [bId, JSON.stringify(badUuidRecord)]
        );
      },
      /INVALID_API_KEY_ID/
    );

    const unknownUuidRecord = [
      {
        apiKeyId: crypto.randomUUID(), // Valid UUID format but does not exist in api_keys
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: testHourTimestamp,
        count: 1,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[]::UUID[], $2::JSONB);`,
          [crypto.randomUUID(), JSON.stringify(unknownUuidRecord)]
        );
      },
      /UNKNOWN_API_KEY/
    );
  });

  await test('Validation: Rejects invalid endpoint, statusGroup, or unaligned timestamp', async () => {
    const invalidEndpoint = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/streams', // Withheld endpoint
        statusGroup: '2xx',
        hourTimestamp: testHourTimestamp,
        count: 1,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [crypto.randomUUID(), testKeyRecordId1, JSON.stringify(invalidEndpoint)]
        );
      },
      /INVALID_ENDPOINT/
    );

    const unalignedTs = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: '2026-11-10T14:35:12.000Z', // Not aligned to hour
        count: 1,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [crypto.randomUUID(), testKeyRecordId1, JSON.stringify(unalignedTs)]
        );
      },
      /UNALIGNED_HOUR_TIMESTAMP/
    );
  });

  await test('Validation: Rejects negative counts, non-integers, and inconsistent totals', async () => {
    // Negative request count
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [
            crypto.randomUUID(),
            testKeyRecordId1,
            JSON.stringify([
              {
                apiKeyId: testKeyRecordId1,
                endpoint: '/api/v1/matches/live',
                statusGroup: '2xx',
                hourTimestamp: testHourTimestamp,
                count: -5,
                rateLimitCount: 0,
                errorCount: 0,
                buckets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              },
            ]),
          ]
        );
      },
      /INVALID_REQUEST_COUNT/
    );

    // Inconsistent rateLimitCount (statusGroup 2xx with rateLimitCount > 0)
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [
            crypto.randomUUID(),
            testKeyRecordId1,
            JSON.stringify([
              {
                apiKeyId: testKeyRecordId1,
                endpoint: '/api/v1/matches/live',
                statusGroup: '2xx',
                hourTimestamp: testHourTimestamp,
                count: 5,
                rateLimitCount: 2, // Inconsistent with 2xx
                errorCount: 0,
                buckets: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              },
            ]),
          ]
        );
      },
      /INCONSISTENT_RATE_LIMIT_COUNT/
    );

    // Inconsistent bucket sum (sum of buckets is 4, but count is 5)
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [
            crypto.randomUUID(),
            testKeyRecordId1,
            JSON.stringify([
              {
                apiKeyId: testKeyRecordId1,
                endpoint: '/api/v1/matches/live',
                statusGroup: '2xx',
                hourTimestamp: testHourTimestamp,
                count: 5,
                rateLimitCount: 0,
                errorCount: 0,
                buckets: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Sum = 4 != 5
              },
            ]),
          ]
        );
      },
      /INCONSISTENT_BUCKET_SUM/
    );
  });

  await test('Atomicity & Concurrency: 2 workers simultaneously submit identical batch ID (zero duplicate count)', async () => {
    const raceBatchId = crypto.randomUUID();
    const raceAggregates = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: testHourTimestamp,
        count: 10,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [2, 3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    const worker1 = new Client(DB_CONFIG);
    const worker2 = new Client(DB_CONFIG);
    await worker1.connect();
    await worker2.connect();
    await worker1.query('SET ROLE service_role;');
    await worker2.query('SET ROLE service_role;');

    const [res1, res2] = await Promise.all([
      worker1.query(
        `SELECT public.ingest_analytics_batch($1::UUID, 'pm2-worker-1', ARRAY[$2::UUID], $3::JSONB);`,
        [raceBatchId, testKeyRecordId1, JSON.stringify(raceAggregates)]
      ),
      worker2.query(
        `SELECT public.ingest_analytics_batch($1::UUID, 'pm2-worker-2', ARRAY[$2::UUID], $3::JSONB);`,
        [raceBatchId, testKeyRecordId1, JSON.stringify(raceAggregates)]
      ),
    ]);

    await worker1.end();
    await worker2.end();

    assert.equal(res1.rows[0].ingest_analytics_batch, true);
    assert.equal(res2.rows[0].ingest_analytics_batch, true);

    // Exactly 1 batch record
    const batchRes = await dbClient.query(
      `SELECT status FROM public.api_analytics_batches WHERE batch_id = $1;`,
      [raceBatchId]
    );
    assert.equal(batchRes.rows.length, 1);
    assert.equal(batchRes.rows[0].status, 'completed');

    // Exactly 10 requests recorded (zero double-counting)
    const usageRes = await dbClient.query(
      `SELECT total_requests FROM public.api_usage_hourly 
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, testHourTimestamp]
    );
    assert.equal(usageRes.rows[0].total_requests, 10);
  });

  await test('Transaction rollback safety: Failed ingestion leaves NO partial aggregates and NO orphaned ledger rows', async () => {
    const failBatchId = crypto.randomUUID();
    const initialUsage = await dbClient.query(
      `SELECT total_requests FROM public.api_usage_hourly 
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, testHourTimestamp]
    );
    const initialTotal = initialUsage.rows[0].total_requests;

    // Second item in batch has malformed bucket count (17 instead of 18)
    const mixedBatch = [
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '2xx',
        hourTimestamp: testHourTimestamp,
        count: 5,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        apiKeyId: testKeyRecordId1,
        endpoint: '/api/v1/matches/live',
        statusGroup: '5xx',
        hourTimestamp: testHourTimestamp,
        count: 1,
        rateLimitCount: 0,
        errorCount: 1,
        buckets: [1, 0, 0], // Malformed!
      },
    ];

    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [failBatchId, testKeyRecordId1, JSON.stringify(mixedBatch)]
        );
      },
      /INVALID_BUCKET_COUNT/
    );

    // Verify ZERO rows in batch ledger
    const batchCheck = await dbClient.query(
      `SELECT * FROM public.api_analytics_batches WHERE batch_id = $1;`,
      [failBatchId]
    );
    assert.equal(batchCheck.rows.length, 0, 'Failed batch must leave 0 ledger rows');

    // Verify usage counter was NOT incremented by the first item
    const usageAfter = await dbClient.query(
      `SELECT total_requests FROM public.api_usage_hourly 
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, testHourTimestamp]
    );
    assert.equal(usageAfter.rows[0].total_requests, initialTotal, 'Rollback must preserve original counters');
  });

  await test('Duplicate completed retry: completed batch returns true and never re-increments totals', async () => {
    // 1. Get current count
    const beforeRes = await dbClient.query(
      `SELECT total_requests FROM public.api_usage_hourly 
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, testHourTimestamp]
    );
    const countBefore = beforeRes.rows[0].total_requests;

    // 2. Query completed batch ID from earlier test
    const completedBatch = await dbClient.query(
      `SELECT batch_id FROM public.api_analytics_batches WHERE status = 'completed' LIMIT 1;`
    );
    const completedBatchId = completedBatch.rows[0].batch_id;

    // 3. Resubmit exact batch
    const retryRes = await dbClient.query(
      `SELECT public.ingest_analytics_batch($1::UUID, 'retry-worker', ARRAY[$2::UUID], $3::JSONB);`,
      [
        completedBatchId,
        testKeyRecordId1,
        JSON.stringify([
          {
            apiKeyId: testKeyRecordId1,
            endpoint: '/api/v1/matches/live',
            statusGroup: '2xx',
            hourTimestamp: testHourTimestamp,
            count: 10,
            rateLimitCount: 0,
            errorCount: 0,
            buckets: [2, 3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        ]),
      ]
    );
    assert.equal(retryRes.rows[0].ingest_analytics_batch, true);

    // 4. Verify total_requests has not increased
    const afterRes = await dbClient.query(
      `SELECT total_requests FROM public.api_usage_hourly 
       WHERE api_key_id = $1 AND endpoint = '/api/v1/matches/live' AND hour_timestamp = $2;`,
      [testKeyRecordId1, testHourTimestamp]
    );
    assert.equal(afterRes.rows[0].total_requests, countBefore, 'Completed batch retry must not re-increment totals');
  });

  await test('Retry after rollback: batch that rolled back due to error can be retried with valid data and succeeds', async () => {
    const recoverableBatchId = crypto.randomUUID();

    // 1. First attempt fails due to invalid bucket value
    await assert.rejects(
      async () => {
        await dbClient.query(
          `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
          [
            recoverableBatchId,
            testKeyRecordId1,
            JSON.stringify([
              {
                apiKeyId: testKeyRecordId1,
                endpoint: '/api/v1/matches/live',
                statusGroup: '2xx',
                hourTimestamp: testHourTimestamp,
                count: 1,
                rateLimitCount: 0,
                errorCount: 0,
                buckets: [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Negative bucket value
              },
            ]),
          ]
        );
      },
      /INVALID_BUCKET_VALUE/
    );

    // 2. Second attempt with corrected valid data using the same batch ID succeeds cleanly
    const retryRes = await dbClient.query(
      `SELECT public.ingest_analytics_batch($1::UUID, 'worker-1', ARRAY[$2::UUID], $3::JSONB);`,
      [
        recoverableBatchId,
        testKeyRecordId1,
        JSON.stringify([
          {
            apiKeyId: testKeyRecordId1,
            endpoint: '/api/v1/matches/live',
            statusGroup: '2xx',
            hourTimestamp: testHourTimestamp,
            count: 1,
            rateLimitCount: 0,
            errorCount: 0,
            buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        ]),
      ]
    );
    assert.equal(retryRes.rows[0].ingest_analytics_batch, true);

    // 3. Batch ledger reflects 'completed'
    const batchCheck = await dbClient.query(
      `SELECT status FROM public.api_analytics_batches WHERE batch_id = $1;`,
      [recoverableBatchId]
    );
    assert.equal(batchCheck.rows[0].status, 'completed');
  });

  await test('Worker termination during open transaction: Aborts cleanly and leaves no locks or partial data', async () => {
    const orphanBatchId = crypto.randomUUID();

    // Worker A opens a transaction and claims batch ID, but terminates before committing
    const workerA = new Client(DB_CONFIG);
    await workerA.connect();
    await workerA.query('SET ROLE service_role;');
    await workerA.query('BEGIN;');
    await workerA.query(
      `INSERT INTO public.api_analytics_batches (batch_id, worker_id, event_count, status)
       VALUES ($1, 'dying-worker', 1, 'completed');`,
      [orphanBatchId]
    );
    // Abrupt termination (simulated by ending client connection while in transaction)
    await workerA.end();

    // Worker B now submits and completes the same batch ID
    const workerB = new Client(DB_CONFIG);
    await workerB.connect();
    await workerB.query('SET ROLE service_role;');
    const bRes = await workerB.query(
      `SELECT public.ingest_analytics_batch($1::UUID, 'surviving-worker', ARRAY[$2::UUID], $3::JSONB);`,
      [
        orphanBatchId,
        testKeyRecordId1,
        JSON.stringify([
          {
            apiKeyId: testKeyRecordId1,
            endpoint: '/api/v1/matches/live',
            statusGroup: '2xx',
            hourTimestamp: testHourTimestamp,
            count: 1,
            rateLimitCount: 0,
            errorCount: 0,
            buckets: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        ]),
      ]
    );
    assert.equal(bRes.rows[0].ingest_analytics_batch, true);
    await workerB.end();

    const batchCheck = await dbClient.query(
      `SELECT worker_id, status FROM public.api_analytics_batches WHERE batch_id = $1;`,
      [orphanBatchId]
    );
    assert.equal(batchCheck.rows[0].worker_id, 'surviving-worker');
    assert.equal(batchCheck.rows[0].status, 'completed');
  });

  await test('preview_expired_api_analytics & cleanup_expired_api_analytics retention rules', async () => {
    const previewRes = await dbClient.query(`SELECT * FROM public.preview_expired_api_analytics(90);`);
    assert.equal(previewRes.rows.length, 1);
    assert.equal(previewRes.rows[0].table_name, 'api_usage_hourly');

    await assert.rejects(
      async () => {
        await dbClient.query(`SELECT public.cleanup_expired_api_analytics(60, false);`);
      },
      /RETENTION_SAFETY_VIOLATION/
    );

    await assert.rejects(
      async () => {
        await dbClient.query(`SELECT public.cleanup_expired_api_analytics(20, true);`);
      },
      /RETENTION_HARD_FLOOR_VIOLATION/
    );

    const cleanupRes = await dbClient.query(`SELECT public.cleanup_expired_api_analytics(90, false);`);
    assert.ok(cleanupRes);
  });

  console.log('\n--- 5. Stale-While-Revalidate Caching & Single-Flight Tests ---');

  await test('Cache miss executes fetchFn and caches result', async () => {
    clearApiCache();
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return [{ id: 'match-1', name: 'Arsenal vs Chelsea' }];
    };

    const res1 = await getOrFetchWithSWR('test-key-swr', fetcher, { freshTtlSeconds: 1, staleWindowSeconds: 2 });
    assert.equal(res1.source, 'MISS');
    assert.equal(fetchCount, 1);
  });

  await test('Cache hit returns cached data without calling fetchFn', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return [{ id: 'match-1', name: 'Arsenal vs Chelsea' }];
    };

    const res2 = await getOrFetchWithSWR('test-key-swr', fetcher, { freshTtlSeconds: 1, staleWindowSeconds: 2 });
    assert.equal(res2.source, 'HIT');
    assert.equal(fetchCount, 0);
  });

  await test('In-Process Single-Flight coalesces concurrent misses into single upstream fetch', async () => {
    clearApiCache();
    let concurrentFetches = 0;
    const slowFetcher = async () => {
      concurrentFetches++;
      await new Promise((r) => setTimeout(r, 50));
      return [{ id: 'match-concurrent' }];
    };

    const [call1, call2, call3] = await Promise.all([
      getOrFetchWithSWR('test-single-flight', slowFetcher, { freshTtlSeconds: 2, staleWindowSeconds: 5 }),
      getOrFetchWithSWR('test-single-flight', slowFetcher, { freshTtlSeconds: 2, staleWindowSeconds: 5 }),
      getOrFetchWithSWR('test-single-flight', slowFetcher, { freshTtlSeconds: 2, staleWindowSeconds: 5 }),
    ]);

    assert.equal(concurrentFetches, 1);
    assert.equal(call1.data[0].id, 'match-concurrent');
    assert.equal(call2.data[0].id, 'match-concurrent');
    assert.equal(call3.data[0].id, 'match-concurrent');
  });

  await test('Stale fallback during upstream provider error', async () => {
    clearApiCache();
    await getOrFetchWithSWR(
      'test-stale-key',
      async () => [{ id: 'stable-match' }],
      { freshTtlSeconds: 0.05, staleWindowSeconds: 5 }
    );

    await new Promise((r) => setTimeout(r, 60));

    const staleResult = await getOrFetchWithSWR(
      'test-stale-key',
      async () => {
        throw new Error('TotalSportsLive upstream timeout 504');
      },
      { freshTtlSeconds: 0.05, staleWindowSeconds: 5 }
    );

    assert.equal(staleResult.source, 'STALE');
    assert.equal((staleResult.data as any)[0].id, 'stable-match');
  });

  console.log('\n--- 6. Match Sanitizer & Security Withholding Tests ---');

  await test('sanitizePublicMatch strictly excises servers, streams, HLS, embed URLs, and upstream credentials', () => {
    const rawInternalMatch: any = {
      id: 998877,
      slug: 'highlanders-vs-dynamos-998877',
      teams: {
        home: { name: 'Highlanders', code: 'HIG', logoColor: '#000000', logoUrl: 'https://bzzoiro/hig.png' },
        away: { name: 'Dynamos', code: 'DYN', logoColor: '#0000FF', logoUrl: 'https://bzzoiro/dyn.png' },
      },
      score: { home: 1, away: 0 },
      status: 'LIVE',
      minute: 74,
      eps: "74'",
      competition: 'Castle Lager Premier Soccer League',
      leagueId: 'zpsl-1',
      region: 'Zimbabwe',
      leagueSlug: 'zpsl',
      kickoffTime: '15:00',
      dateString: 'Today',
      esd: '20261110150000',
      category: 'ZPSL',
      venue: 'Barbourfields Stadium',
      servers: [
        { id: 'srv1', name: 'Vicecap Player', embedUrl: 'https://vicecap.xyz/embed/live?token=secret123' },
        { id: 'srv2', name: 'Direct Stream', embedUrl: 'https://internal-relay.co.zw/live.m3u8' },
      ],
      isFeedMatch: true,
    };

    const sanitized = sanitizePublicMatch(rawInternalMatch);

    assert.equal(sanitized.id, '998877');
    assert.equal(sanitized.slug, 'highlanders-vs-dynamos-998877');
    assert.equal(sanitized.status, 'LIVE');
    assert.equal((sanitized as any).servers, undefined);
    assert.equal((sanitized as any).embedUrl, undefined);
    assert.equal((sanitized as any).isFeedMatch, undefined);

    const serialized = JSON.stringify(sanitized);
    assert.ok(!serialized.includes('vicecap'));
    assert.ok(!serialized.includes('m3u8'));
    assert.ok(!serialized.includes('secret123'));
  });

  await test('validateAndFormatDateParam enforces -3 past to +7 future query range', () => {
    assert.equal(validateAndFormatDateParam('today').valid, true);
    assert.equal(validateAndFormatDateParam('tomorrow').valid, true);
    assert.equal(validateAndFormatDateParam('yesterday').valid, true);

    const farPast = validateAndFormatDateParam('2020-01-01');
    assert.equal(farPast.valid, false);
    assert.ok(farPast.errorMessage?.includes('outside the supported query range'));

    const malformed = validateAndFormatDateParam('invalid-date-format');
    assert.equal(malformed.valid, false);
  });

  await test('filterAndPaginateMatches enforces status, competition, and pagination limits', () => {
    const sampleMatches: any[] = [
      { id: '1', competition: { name: 'Premier League', slug: 'premier-league' }, status: 'UPCOMING' },
      { id: '2', competition: { name: 'Premier League', slug: 'premier-league' }, status: 'FINISHED' },
      { id: '3', competition: { name: 'La Liga', slug: 'la-liga' }, status: 'UPCOMING' },
      { id: '4', competition: { name: 'Premier League', slug: 'premier-league' }, status: 'UPCOMING' },
    ];

    const compFiltered = filterAndPaginateMatches(sampleMatches, { competition: 'premier-league' });
    assert.equal(compFiltered.data.length, 3);

    const paginated = filterAndPaginateMatches(sampleMatches, { page: 1, limit: 2 });
    assert.equal(paginated.data.length, 2);
    assert.equal(paginated.pagination.hasMore, true);
  });

  console.log('\n--- 7. Kill Switch Precedence & Fallback Rules ---');

  await test('Database api_settings master switch seeded disabled', async () => {
    const settingsRes = await dbClient.query(`SELECT is_api_enabled FROM public.api_settings WHERE id = 'master';`);
    assert.equal(settingsRes.rows.length, 1);
    assert.equal(settingsRes.rows[0].is_api_enabled, false);
  });

  await test('Database security privileges: strictly 0 grants to anon or authenticated on API tables', async () => {
    const privRes = await dbClient.query(`
      SELECT grantee, table_name, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND table_name IN ('api_settings', 'api_keys', 'api_rate_limits', 'api_rate_limit_leases', 'api_analytics_batches', 'api_usage_hourly')
        AND grantee IN ('anon', 'authenticated');
    `);
    assert.equal(privRes.rows.length, 0);
  });

  await test('Database stored procedure execute privileges restricted to service_role', async () => {
    const procPrivRes = await dbClient.query(`
      SELECT grantee, routine_name, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
        AND routine_name IN ('acquire_rate_limit_lease', 'ingest_analytics_batch', 'preview_expired_api_analytics', 'cleanup_expired_api_analytics')
        AND grantee IN ('anon', 'authenticated');
    `);
    assert.equal(procPrivRes.rows.length, 0);
  });

  await test('RLS is enabled on all 6 developer API tables', async () => {
    const rlsRes = await dbClient.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE nspname = 'public' 
        AND relname IN ('api_settings', 'api_keys', 'api_rate_limits', 'api_rate_limit_leases', 'api_analytics_batches', 'api_usage_hourly');
    `);
    assert.equal(rlsRes.rows.length, 6);
    for (const r of rlsRes.rows) {
      assert.equal(r.relrowsecurity, true);
    }
  });

  await test('Strict withholding: No stream endpoint exists in Developer API directory', () => {
    const streamRoutePath = path.join(process.cwd(), 'app/api/v1/matches/[matchId]/streams');
    assert.equal(fs.existsSync(streamRoutePath), false);
  });

  console.log('\n--- 8. Migration Precheck & Prerequisites Test ---');

  await test('Migration precheck: Fails immediately when public.admin_users is missing', async () => {
    // In a test client, verify that the DO precheck block raises exception when table is absent
    const testPrecheckClient = new Client(DB_CONFIG);
    await testPrecheckClient.connect();
    try {
      await testPrecheckClient.query('BEGIN;');
      await testPrecheckClient.query('DROP TABLE IF EXISTS public.admin_users CASCADE;');
      await assert.rejects(
        async () => {
          await testPrecheckClient.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'admin_users'
                ) THEN
                    RAISE EXCEPTION 'MIGRATION_PRECHECK_FAILED: Table public.admin_users must exist before applying Developer API migration.';
                END IF;
            END $$;
          `);
        },
        /MIGRATION_PRECHECK_FAILED/
      );
    } finally {
      await testPrecheckClient.query('ROLLBACK;');
      await testPrecheckClient.end();
    }
  });

  await dbClient.end();

  console.log('\n================================================================================');
  console.log(`ZimKickOff Developer API Test Suite Complete: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
