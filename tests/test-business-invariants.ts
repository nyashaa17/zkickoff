import { Client } from 'pg';
import assert from 'node:assert/strict';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54321,
  user: 'postgres',
  password: 'postgres',
  database: 'zimkickoff_test',
};

console.log('--- Running Business Invariants & Atomic Procedure Tests ---');

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: (client: Client) => Promise<void>) {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
    await client.query('SET ROLE service_role;');
    await fn(client);
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  } finally {
    await client.end();
  }
}

async function main() {
  // Setup: clean tables
  const setupClient = new Client(DB_CONFIG);
  await setupClient.connect();
  await setupClient.query('SET ROLE service_role;');
  await setupClient.query('DELETE FROM public.events;');
  await setupClient.end();

  // Test 1: Empty-source draft succeeds
  await runTest('Invariant: Empty-source draft succeeds', async (client) => {
    const res = await client.query(`
      SELECT * FROM public.create_event_atomic(
        'Draft Match Event',
        'draft-match-event',
        'Testing draft event with 0 sources',
        'Football',
        NULL,
        now(),
        NULL,
        'draft',
        'upcoming',
        NULL,
        '[]'::jsonb
      );
    `);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].publication_status, 'draft');
    assert.equal(res.rows[0].version, 1);
  });

  // Test 2: Empty-source publish fails
  await runTest('Invariant: Empty-source publish fails', async (client) => {
    let threw = false;
    try {
      await client.query(`
        SELECT * FROM public.create_event_atomic(
          'Published Empty Event',
          'published-empty-event',
          'Must fail because 0 sources',
          'Football',
          NULL,
          now(),
          NULL,
          'published',
          'upcoming',
          NULL,
          '[]'::jsonb
        );
      `);
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_PUBLISHED_REQUIRES_SOURCE'));
      assert.equal(err.code, '23514');
    }
    assert.equal(threw, true, 'Publishing with 0 sources must fail with ERR_PUBLISHED_REQUIRES_SOURCE');
  });

  // Test 3: Exactly one primary source succeeds
  let createdEventId: string;
  await runTest('Invariant: Exactly one primary source succeeds for published event', async (client) => {
    const sources = [
      {
        name: 'Primary HLS Feed',
        stream_type: 'hls',
        stream_url: 'https://cdn.example.com/hls/live.m3u8',
        is_primary: true,
        display_order: 0,
      },
      {
        name: 'Secondary YouTube Feed',
        stream_type: 'youtube',
        stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        is_primary: false,
        display_order: 1,
      },
    ];

    const res = await client.query(
      `SELECT * FROM public.create_event_atomic(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
      );`,
      [
        'Highlanders vs Dynamos Derby',
        'highlanders-vs-dynamos-derby',
        'The Great Harare Derby',
        'ZPSL Football',
        null,
        new Date().toISOString(),
        null,
        'published',
        'live',
        null,
        JSON.stringify(sources),
      ]
    );

    assert.equal(res.rows.length, 1);
    createdEventId = res.rows[0].id;
    assert.equal(res.rows[0].publication_status, 'published');
    assert.equal(res.rows[0].version, 1);

    // Verify sources in database
    const srcRes = await client.query('SELECT * FROM public.event_sources WHERE event_id = $1 ORDER BY display_order;', [createdEventId]);
    assert.equal(srcRes.rows.length, 2);
    assert.equal(srcRes.rows[0].is_primary, true);
    assert.equal(srcRes.rows[1].is_primary, false);
  });

  // Test 4: Multiple primary sources fail
  await runTest('Invariant: Multiple primary sources fail with ERR_PRIMARY_SOURCE_REQUIRED', async (client) => {
    const sources = [
      { name: 'Feed 1', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: true, display_order: 0 },
      { name: 'Feed 2', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: true, display_order: 1 },
    ];

    let threw = false;
    try {
      await client.query(
        `SELECT * FROM public.create_event_atomic(
          'Multi Primary Event', 'multi-primary', 'desc', 'Rugby', NULL, now(), NULL, 'draft', 'upcoming', NULL, $1::jsonb
        );`,
        [JSON.stringify(sources)]
      );
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_PRIMARY_SOURCE_REQUIRED'));
      assert.equal(err.code, '23514');
    }
    assert.equal(threw, true);
  });

  // Test 5: Zero primary sources fail when sources exist
  await runTest('Invariant: Zero primary sources fail when sources exist', async (client) => {
    const sources = [
      { name: 'Feed 1', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: false, display_order: 0 },
      { name: 'Feed 2', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: false, display_order: 1 },
    ];

    let threw = false;
    try {
      await client.query(
        `SELECT * FROM public.create_event_atomic(
          'Zero Primary Event', 'zero-primary', 'desc', 'Rugby', NULL, now(), NULL, 'draft', 'upcoming', NULL, $1::jsonb
        );`,
        [JSON.stringify(sources)]
      );
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_PRIMARY_SOURCE_REQUIRED'));
    }
    assert.equal(threw, true);
  });

  // Test 6: Duplicate display orders fail
  await runTest('Invariant: Duplicate display order fails cleanly with ERR_DUPLICATE_DISPLAY_ORDER', async (client) => {
    const sources = [
      { name: 'Feed 1', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: true, display_order: 0 },
      { name: 'Feed 2', stream_type: 'youtube', stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', is_primary: false, display_order: 0 },
    ];

    let threw = false;
    try {
      await client.query(
        `SELECT * FROM public.create_event_atomic(
          'Dup Order Event', 'dup-order-event', 'desc', 'Rugby', NULL, now(), NULL, 'draft', 'upcoming', NULL, $1::jsonb
        );`,
        [JSON.stringify(sources)]
      );
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_DUPLICATE_DISPLAY_ORDER'));
      assert.equal(err.code, '23505');
    }
    assert.equal(threw, true);
  });

  // Test 7: Duplicate slugs fail cleanly
  await runTest('Invariant: Duplicate slug fails with ERR_DUPLICATE_SLUG', async (client) => {
    let threw = false;
    try {
      await client.query(`
        SELECT * FROM public.create_event_atomic(
          'Duplicate Slug Clash',
          'highlanders-vs-dynamos-derby',
          'Attempting reuse of slug',
          'Football',
          NULL,
          now(),
          NULL,
          'draft',
          'upcoming',
          NULL,
          '[]'::jsonb
        );
      `);
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_DUPLICATE_SLUG'));
      assert.equal(err.code, '23505');
    }
    assert.equal(threw, true);
  });

  // Test 8: Invalid event times fail (end_time < start_time)
  await runTest('Invariant: Inverted start and end times fail constraint', async (client) => {
    let threw = false;
    try {
      await client.query(`
        SELECT * FROM public.create_event_atomic(
          'Time Travel Event',
          'time-travel-event',
          'End before start',
          'Football',
          NULL,
          '2026-10-26 15:00:00+00',
          '2026-10-26 14:00:00+00',
          'draft',
          'upcoming',
          NULL,
          '[]'::jsonb
        );
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '23514');
      assert.ok(err.message.includes('chk_events_time_order'));
    }
    assert.equal(threw, true);
  });

  // Test 9: Atomic update increments version and atomically replaces sources
  await runTest('Invariant: Atomic update increments version to 2 and replaces sources', async (client) => {
    const newSources = [
      {
        name: 'New Primary 4K Feed',
        stream_type: 'hls',
        stream_url: 'https://cdn.example.com/hls/4k.m3u8',
        is_primary: true,
        display_order: 0,
      },
    ];

    const res = await client.query(
      `SELECT * FROM public.update_event_atomic(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
      );`,
      [
        createdEventId,
        1, // expected_version
        'Highlanders vs Dynamos Derby (Updated)',
        'highlanders-vs-dynamos-derby',
        'Updated description',
        'ZPSL Football',
        null,
        new Date().toISOString(),
        null,
        'published',
        'live',
        JSON.stringify(newSources),
      ]
    );

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].version, 2, 'Version must be incremented to 2');

    // Verify sources were completely replaced
    const srcRes = await client.query('SELECT * FROM public.event_sources WHERE event_id = $1;', [createdEventId]);
    assert.equal(srcRes.rows.length, 1);
    assert.equal(srcRes.rows[0].name, 'New Primary 4K Feed');
  });

  // Test 10: Stale update rejected (optimistic concurrency)
  await runTest('Invariant: Stale update with version = 1 rejected when version is 2', async (client) => {
    let threw = false;
    try {
      await client.query(
        `SELECT * FROM public.update_event_atomic(
          $1, 1, 'Stale Edit', 'highlanders-vs-dynamos-derby', 'desc', 'Football', NULL, now(), NULL, 'published', 'live', '[]'::jsonb
        );`,
        [createdEventId]
      );
    } catch (err: any) {
      threw = true;
      assert.ok(err.message.includes('ERR_STALE_VERSION'));
      assert.equal(err.code, 'P0004');
    }
    assert.equal(threw, true);
  });

  // Test 11: Archive transition preserves integrity
  await runTest('Invariant: Transition to archived status preserves versioning', async (client) => {
    const res = await client.query(
      `SELECT * FROM public.update_event_atomic(
        $1, 2, 'Highlanders vs Dynamos Derby (Archived)', 'highlanders-vs-dynamos-derby', 'desc', 'Football', NULL, now(), NULL, 'archived', 'concluded', $2::jsonb
      );`,
      [
        createdEventId,
        JSON.stringify([
          { name: 'Archive Feed', stream_type: 'hls', stream_url: 'https://cdn.example.com/hls/4k.m3u8', is_primary: true, display_order: 0 },
        ]),
      ]
    );

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].publication_status, 'archived');
    assert.equal(res.rows[0].broadcast_status, 'concluded');
    assert.equal(res.rows[0].version, 3);
  });

  console.log(`\nBusiness Invariants Tests Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
