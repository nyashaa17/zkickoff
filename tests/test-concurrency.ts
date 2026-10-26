import { Client } from 'pg';
import assert from 'node:assert/strict';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54321,
  user: 'postgres',
  password: 'postgres',
  database: 'zimkickoff_test',
};

console.log('--- Running Comprehensive Concurrency, Lock Graph & Race Protection Test Suite ---');

let passed = 0;
let failed = 0;

async function createClient(): Promise<Client> {
  const c = new Client(DB_CONFIG);
  await c.connect();
  await c.query('SET ROLE service_role;');
  return c;
}

async function main() {
  const cAdmin = await createClient();

  // =========================================================================
  // Test 1: Concurrent updates with the same expected_version (Repeated 3x)
  // =========================================================================
  for (let run = 1; run <= 3; run++) {
    try {
      console.log(`\n[Test 1, Run ${run}]: Concurrent updates with expected_version = 1`);
      const createRes = await cAdmin.query(`
        SELECT * FROM public.create_event_atomic(
          'Race Event ${run}', 'race-event-${run}', 'Initial', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
        );
      `);
      const eventId = createRes.rows[0].id;

      const c1 = await createClient();
      const c2 = await createClient();

      let c1Result: any = null, c1Error: any = null;
      let c2Result: any = null, c2Error: any = null;

      const p1 = c1.query(
        `SELECT * FROM public.update_event_atomic(
          $1, 1, 'Update from Conn 1', 'race-event-${run}', 'desc 1', 'Football', NULL, now(), NULL, 'draft', 'upcoming', '[]'::jsonb
        );`,
        [eventId]
      ).then((r) => { c1Result = r; }).catch((e) => { c1Error = e; });

      const p2 = c2.query(
        `SELECT * FROM public.update_event_atomic(
          $1, 1, 'Update from Conn 2', 'race-event-${run}', 'desc 2', 'Football', NULL, now(), NULL, 'draft', 'upcoming', '[]'::jsonb
        );`,
        [eventId]
      ).then((r) => { c2Result = r; }).catch((e) => { c2Error = e; });

      await Promise.all([p1, p2]);
      await c1.end();
      await c2.end();

      const successCount = (c1Result ? 1 : 0) + (c2Result ? 1 : 0);
      const conflictCount = (c1Error?.message?.includes('ERR_STALE_VERSION') ? 1 : 0) +
                            (c2Error?.message?.includes('ERR_STALE_VERSION') ? 1 : 0);

      assert.equal(successCount, 1, `Run ${run}: Expected exactly 1 success`);
      assert.equal(conflictCount, 1, `Run ${run}: Expected exactly 1 ERR_STALE_VERSION conflict`);

      const verifyRes = await cAdmin.query('SELECT version FROM public.events WHERE id = $1;', [eventId]);
      assert.equal(verifyRes.rows[0].version, 2, `Run ${run}: Expected version 2`);

      console.log(`✓ PASS: Test 1 Run ${run} verified optimistic concurrency serialization`);
      passed++;
    } catch (err: any) {
      console.error(`✗ FAIL: Test 1 Run ${run} failed:`, err.message);
      failed++;
    }
  }

  // =========================================================================
  // Test 2: Publishing while the last valid source is removed
  // =========================================================================
  try {
    console.log('\n[Test 2]: Publishing while the last valid source is removed');
    const sourcePayload = [
      { name: 'Only Feed', stream_type: 'hls', stream_url: 'https://example.com/live.m3u8', is_primary: true, display_order: 0 },
    ];
    const createRes = await cAdmin.query(
      `SELECT * FROM public.create_event_atomic(
        'Draft with 1 source', 'draft-last-source', 'desc', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL, $1::jsonb
      );`,
      [JSON.stringify(sourcePayload)]
    );
    const eventId = createRes.rows[0].id;
    const srcRes = await cAdmin.query('SELECT id FROM public.event_sources WHERE event_id = $1;', [eventId]);
    const sourceId = srcRes.rows[0].id;

    const c1 = await createClient();
    const c2 = await createClient();

    let c1Error: any = null, c2Error: any = null;

    const p1 = (async () => {
      try {
        await c1.query('BEGIN;');
        await c1.query(`UPDATE public.events SET publication_status = 'published' WHERE id = $1;`, [eventId]);
        await new Promise((r) => setTimeout(r, 40));
        await c1.query('COMMIT;');
      } catch (e) {
        await c1.query('ROLLBACK;').catch(() => {});
        c1Error = e;
      }
    })();

    const p2 = (async () => {
      try {
        await c2.query('BEGIN;');
        await c2.query(`DELETE FROM public.event_sources WHERE id = $1;`, [sourceId]);
        await new Promise((r) => setTimeout(r, 40));
        await c2.query('COMMIT;');
      } catch (e) {
        await c2.query('ROLLBACK;').catch(() => {});
        c2Error = e;
      }
    })();

    await Promise.all([p1, p2]);
    await c1.end();
    await c2.end();

    const verifyRes = await cAdmin.query('SELECT publication_status FROM public.events WHERE id = $1;', [eventId]);
    const countRes = await cAdmin.query('SELECT count(*) FROM public.event_sources WHERE event_id = $1;', [eventId]);
    const status = verifyRes.rows[0].publication_status;
    const count = parseInt(countRes.rows[0].count, 10);

    // INVARIANT: Never commit published with 0 sources!
    if (status === 'published') {
      assert.ok(count >= 1, 'If published, must have at least 1 source');
    } else {
      assert.ok(count === 0, 'If unpublished, sources were deleted');
    }

    console.log(`✓ PASS: Publication & Source deletion race protected (Committed: status=${status}, sources=${count})`);
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 2 failed:', err.message);
    failed++;
  }

  // =========================================================================
  // Test 3: Cross-event source reassignment in opposite transaction order (Repeated 3x)
  // =========================================================================
  for (let run = 1; run <= 3; run++) {
    try {
      console.log(`\n[Test 3, Run ${run}]: Cross-event source reassignment in opposite transaction order`);
      const resA = await cAdmin.query(`
        SELECT * FROM public.create_event_atomic(
          'Event Alpha ${run}', 'event-alpha-${run}', 'desc', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL,
          '[{"name":"Source A1","stream_type":"hls","stream_url":"https://example.com/a1.m3u8","is_primary":true,"display_order":0},
            {"name":"Source A2","stream_type":"hls","stream_url":"https://example.com/a2.m3u8","is_primary":false,"display_order":1}]'::jsonb
        );
      `);
      const resB = await cAdmin.query(`
        SELECT * FROM public.create_event_atomic(
          'Event Beta ${run}', 'event-beta-${run}', 'desc', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL,
          '[{"name":"Source B1","stream_type":"hls","stream_url":"https://example.com/b1.m3u8","is_primary":true,"display_order":0},
            {"name":"Source B2","stream_type":"hls","stream_url":"https://example.com/b2.m3u8","is_primary":false,"display_order":1}]'::jsonb
        );
      `);

      const eventAId = resA.rows[0].id;
      const eventBId = resB.rows[0].id;

      const srcA = await cAdmin.query('SELECT id FROM public.event_sources WHERE event_id = $1 AND is_primary = false;', [eventAId]);
      const srcB = await cAdmin.query('SELECT id FROM public.event_sources WHERE event_id = $1 AND is_primary = false;', [eventBId]);
      const sourceA2Id = srcA.rows[0].id;
      const sourceB2Id = srcB.rows[0].id;

      const c1 = await createClient();
      const c2 = await createClient();

      let deadlockDetected = false;

      const p1 = (async () => {
        try {
          await c1.query('BEGIN;');
          await c1.query('UPDATE public.event_sources SET event_id = $1, display_order = 5 WHERE id = $2;', [eventBId, sourceA2Id]);
          await new Promise((r) => setTimeout(r, 30));
          await c1.query('COMMIT;');
        } catch (err: any) {
          if (err.code === '40P01') deadlockDetected = true;
          await c1.query('ROLLBACK;').catch(() => {});
        }
      })();

      const p2 = (async () => {
        try {
          await c2.query('BEGIN;');
          await c2.query('UPDATE public.event_sources SET event_id = $1, display_order = 6 WHERE id = $2;', [eventAId, sourceB2Id]);
          await new Promise((r) => setTimeout(r, 30));
          await c2.query('COMMIT;');
        } catch (err: any) {
          if (err.code === '40P01') deadlockDetected = true;
          await c2.query('ROLLBACK;').catch(() => {});
        }
      })();

      await Promise.all([p1, p2]);
      await c1.end();
      await c2.end();

      assert.equal(deadlockDetected, false, `Run ${run}: Deadlock 40P01 must NOT occur`);
      console.log(`✓ PASS: Test 3 Run ${run} verified deterministic ascending UUID locking prevents deadlocks`);
      passed++;
    } catch (err: any) {
      console.error(`✗ FAIL: Test 3 Run ${run} failed:`, err.message);
      failed++;
    }
  }

  // =========================================================================
  // Test 4: Concurrent creation using the same slug
  // =========================================================================
  try {
    console.log('\n[Test 4]: Concurrent creation using the same slug');
    const c1 = await createClient();
    const c2 = await createClient();

    let c1Res: any = null, c1Err: any = null;
    let c2Res: any = null, c2Err: any = null;

    const targetSlug = 'concurrent-slug-collision';

    const p1 = c1.query(
      `SELECT * FROM public.create_event_atomic(
        'Collision 1', $1, 'desc 1', 'Rugby', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
      );`,
      [targetSlug]
    ).then((r) => { c1Res = r; }).catch((e) => { c1Err = e; });

    const p2 = c2.query(
      `SELECT * FROM public.create_event_atomic(
        'Collision 2', $1, 'desc 2', 'Rugby', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
      );`,
      [targetSlug]
    ).then((r) => { c2Res = r; }).catch((e) => { c2Err = e; });

    await Promise.all([p1, p2]);
    await c1.end();
    await c2.end();

    const successCount = (c1Res ? 1 : 0) + (c2Res ? 1 : 0);
    const slugConflictCount = (c1Err?.message?.includes('ERR_DUPLICATE_SLUG') || c1Err?.code === '23505' ? 1 : 0) +
                             (c2Err?.message?.includes('ERR_DUPLICATE_SLUG') || c2Err?.code === '23505' ? 1 : 0);

    assert.equal(successCount, 1, 'Exactly 1 event creation must succeed');
    assert.equal(slugConflictCount, 1, 'Exactly 1 event creation must fail with unique slug violation');

    const checkRes = await cAdmin.query('SELECT count(*) FROM public.events WHERE slug = $1;', [targetSlug]);
    assert.equal(parseInt(checkRes.rows[0].count, 10), 1);

    console.log('✓ PASS: Concurrent slug creation serialized; exactly 1 created, 1 failed with unique violation');
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 4 failed:', err.message);
    failed++;
  }

  // =========================================================================
  // Test 5: Concurrent assignment of the same display order
  // =========================================================================
  try {
    console.log('\n[Test 5]: Concurrent assignment of the same display order');
    const createRes = await cAdmin.query(`
      SELECT * FROM public.create_event_atomic(
        'Order Race Event', 'order-race-event', 'desc', 'Tennis', NULL, now(), NULL, 'draft', 'upcoming', NULL,
        '[{"name":"Source Primary","stream_type":"hls","stream_url":"https://example.com/p.m3u8","is_primary":true,"display_order":0}]'::jsonb
      );
    `);
    const eventId = createRes.rows[0].id;

    const c1 = await createClient();
    const c2 = await createClient();

    let c1Err: any = null, c2Err: any = null;

    // Both attempt to insert with display_order = 1
    const p1 = (async () => {
      try {
        await c1.query('BEGIN;');
        await c1.query(
          `INSERT INTO public.event_sources (event_id, name, stream_type, stream_url, is_primary, display_order)
           VALUES ($1, 'Conn 1 Feed', 'hls', 'https://example.com/1.m3u8', false, 1);`,
          [eventId]
        );
        await new Promise((r) => setTimeout(r, 40));
        await c1.query('COMMIT;');
      } catch (e) {
        await c1.query('ROLLBACK;').catch(() => {});
        c1Err = e;
      }
    })();

    const p2 = (async () => {
      try {
        await c2.query('BEGIN;');
        await c2.query(
          `INSERT INTO public.event_sources (event_id, name, stream_type, stream_url, is_primary, display_order)
           VALUES ($1, 'Conn 2 Feed', 'hls', 'https://example.com/2.m3u8', false, 1);`,
          [eventId]
        );
        await new Promise((r) => setTimeout(r, 40));
        await c2.query('COMMIT;');
      } catch (e) {
        await c2.query('ROLLBACK;').catch(() => {});
        c2Err = e;
      }
    })();

    await Promise.all([p1, p2]);
    await c1.end();
    await c2.end();

    const uniqueViolationCount = (c1Err?.code === '23505' ? 1 : 0) + (c2Err?.code === '23505' ? 1 : 0);
    assert.equal(uniqueViolationCount, 1, 'Exactly one transaction must fail unique constraint uq_event_sources_order');

    const sourcesRes = await cAdmin.query('SELECT display_order FROM public.event_sources WHERE event_id = $1 ORDER BY display_order;', [eventId]);
    assert.equal(sourcesRes.rows.length, 2, 'Must have exactly 2 sources (order 0 and order 1)');
    assert.equal(sourcesRes.rows[0].display_order, 0);
    assert.equal(sourcesRes.rows[1].display_order, 1);

    console.log('✓ PASS: Concurrent duplicate display order safely aborted with unique violation 23505');
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 5 failed:', err.message);
    failed++;
  }

  // =========================================================================
  // Test 6: Concurrent event deletion and source modification
  // =========================================================================
  try {
    console.log('\n[Test 6]: Concurrent event deletion and source modification');
    const createRes = await cAdmin.query(`
      SELECT * FROM public.create_event_atomic(
        'Deletion Target', 'deletion-target', 'desc', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL,
        '[{"name":"Source 1","stream_type":"hls","stream_url":"https://example.com/del.m3u8","is_primary":true,"display_order":0}]'::jsonb
      );
    `);
    const eventId = createRes.rows[0].id;

    const c1 = await createClient();
    const c2 = await createClient();

    let c2Err: any = null;

    // Conn 1 deletes the event
    // Conn 2 attempts to insert a new source into that event
    const p1 = (async () => {
      await new Promise((r) => setTimeout(r, 10));
      await c1.query('DELETE FROM public.events WHERE id = $1;', [eventId]);
    })();

    const p2 = (async () => {
      try {
        await c2.query('BEGIN;');
        await c2.query(
          `INSERT INTO public.event_sources (event_id, name, stream_type, stream_url, is_primary, display_order)
           VALUES ($1, 'Late Source', 'hls', 'https://example.com/late.m3u8', false, 1);`,
          [eventId]
        );
        await c2.query('COMMIT;');
      } catch (e) {
        await c2.query('ROLLBACK;').catch(() => {});
        c2Err = e;
      }
    })();

    await Promise.all([p1, p2]);
    await c1.end();
    await c2.end();

    // Verify: No orphaned sources remain
    const orphanCheck = await cAdmin.query('SELECT count(*) FROM public.event_sources WHERE event_id = $1;', [eventId]);
    assert.equal(parseInt(orphanCheck.rows[0].count, 10), 0, 'Zero orphaned sources must remain');

    console.log('✓ PASS: Concurrent event deletion serialized cleanly; zero orphaned sources');
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 6 failed:', err.message);
    failed++;
  }

  // =========================================================================
  // Test 7: Moving a source between published and unpublished events
  // =========================================================================
  try {
    console.log('\n[Test 7]: Moving only source from published event to draft event');
    const pubRes = await cAdmin.query(`
      SELECT * FROM public.create_event_atomic(
        'Published Host', 'published-host', 'desc', 'Football', NULL, now(), NULL, 'published', 'live', NULL,
        '[{"name":"Sole Feed","stream_type":"hls","stream_url":"https://example.com/sole.m3u8","is_primary":true,"display_order":0}]'::jsonb
      );
    `);
    const draftRes = await cAdmin.query(`
      SELECT * FROM public.create_event_atomic(
        'Draft Recipient', 'draft-recipient', 'desc', 'Football', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
      );
    `);

    const pubId = pubRes.rows[0].id;
    const draftId = draftRes.rows[0].id;

    const srcRes = await cAdmin.query('SELECT id FROM public.event_sources WHERE event_id = $1;', [pubId]);
    const sourceId = srcRes.rows[0].id;

    // Attempt to move source from published event (which leaves published event with 0 sources)
    let threw = false;
    try {
      await cAdmin.query('BEGIN;');
      await cAdmin.query('UPDATE public.event_sources SET event_id = $1 WHERE id = $2;', [draftId, sourceId]);
      await cAdmin.query('COMMIT;');
    } catch (err: any) {
      threw = true;
      await cAdmin.query('ROLLBACK;').catch(() => {});
      assert.ok(err.message.includes('ERR_PUBLISHED_REQUIRES_SOURCE'));
      assert.equal(err.code, '23514');
    }

    assert.equal(threw, true, 'Moving only source away from published event must abort with ERR_PUBLISHED_REQUIRES_SOURCE');

    // Verify source is still attached to published event
    const verifySrc = await cAdmin.query('SELECT event_id FROM public.event_sources WHERE id = $1;', [sourceId]);
    assert.equal(verifySrc.rows[0].event_id, pubId);

    console.log('✓ PASS: Invariant preserved: Published event prevented from losing its last stream source');
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 7 failed:', err.message);
    failed++;
  }

  // =========================================================================
  // Test 8: Cascade deletion and parent/child interactions
  // =========================================================================
  try {
    console.log('\n[Test 8]: Cascade deletion and foreign key consistency under concurrent operations');
    const createRes = await cAdmin.query(`
      SELECT * FROM public.create_event_atomic(
        'Cascade Parent', 'cascade-parent', 'desc', 'Basketball', NULL, now(), NULL, 'draft', 'upcoming', NULL,
        '[{"name":"Feed A","stream_type":"hls","stream_url":"https://example.com/fa.m3u8","is_primary":true,"display_order":0},
          {"name":"Feed B","stream_type":"hls","stream_url":"https://example.com/fb.m3u8","is_primary":false,"display_order":1},
          {"name":"Feed C","stream_type":"hls","stream_url":"https://example.com/fc.m3u8","is_primary":false,"display_order":2}]'::jsonb
      );
    `);
    const parentId = createRes.rows[0].id;

    const c1 = await createClient();
    const c2 = await createClient();

    // Conn 1 updates a source
    // Conn 2 deletes the parent
    const p1 = c1.query(
      `UPDATE public.event_sources SET name = 'Renamed Feed' WHERE event_id = $1 AND display_order = 1;`,
      [parentId]
    ).catch(() => {});

    const p2 = c2.query(
      `DELETE FROM public.events WHERE id = $1;`,
      [parentId]
    ).catch(() => {});

    await Promise.all([p1, p2]);
    await c1.end();
    await c2.end();

    // Verify: If parent was deleted, zero sources remain
    const parentCheck = await cAdmin.query('SELECT count(*) FROM public.events WHERE id = $1;', [parentId]);
    const childCheck = await cAdmin.query('SELECT count(*) FROM public.event_sources WHERE event_id = $1;', [parentId]);

    if (parseInt(parentCheck.rows[0].count, 10) === 0) {
      assert.equal(parseInt(childCheck.rows[0].count, 10), 0, 'Cascade delete must clean up all child sources');
    }

    console.log('✓ PASS: Parent and child cascade deletion consistent; zero dangling rows');
    passed++;
  } catch (err: any) {
    console.error('✗ FAIL: Test 8 failed:', err.message);
    failed++;
  }

  await cAdmin.end();

  console.log(`\n================================================================================`);
  console.log(`Comprehensive Concurrency Suite Complete: ${passed} passed, ${failed} failed.`);
  console.log(`================================================================================`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal concurrency runner error:', err);
  process.exit(1);
});
