import { Client } from 'pg';
import assert from 'node:assert/strict';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54321,
  user: 'postgres',
  password: 'postgres',
  database: 'zimkickoff_test',
};

console.log('--- Running PostgreSQL Database Access & Security Privilege Tests ---');

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: (client: Client) => Promise<void>) {
  const client = new Client(DB_CONFIG);
  await client.connect();
  try {
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
  // 1. Direct Table Mutations: anon role cannot insert into events
  await runTest('Security: "anon" cannot INSERT into public.events directly', async (client) => {
    await client.query('SET ROLE anon;');
    let threw = false;
    try {
      await client.query(`
        INSERT INTO public.events (title, slug, start_time)
        VALUES ('Hacker Event', 'hacker-event', now());
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501', `Expected 42501 permission_denied, got ${err.code}`);
    }
    assert.equal(threw, true, 'Direct INSERT by anon must fail with 42501');
  });

  // 2. Direct Table Mutations: authenticated non-admin cannot INSERT into events
  await runTest('Security: "authenticated" cannot INSERT into public.events directly', async (client) => {
    await client.query('SET ROLE authenticated;');
    let threw = false;
    try {
      await client.query(`
        INSERT INTO public.events (title, slug, start_time)
        VALUES ('Hacker Event', 'hacker-event', now());
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true, 'Direct INSERT by authenticated must fail with 42501');
  });

  // 3. Direct Table Mutations: anon cannot UPDATE or DELETE public.events
  await runTest('Security: "anon" cannot UPDATE or DELETE public.events', async (client) => {
    await client.query('SET ROLE anon;');
    let updateThrew = false;
    try {
      await client.query(`UPDATE public.events SET title = 'Hacked';`);
    } catch (err: any) {
      updateThrew = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(updateThrew, true);

    let deleteThrew = false;
    try {
      await client.query(`DELETE FROM public.events;`);
    } catch (err: any) {
      deleteThrew = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(deleteThrew, true);
  });

  // 4. Direct Table Mutations: anon/authenticated cannot mutate public.event_sources
  await runTest('Security: "anon" and "authenticated" cannot mutate public.event_sources', async (client) => {
    await client.query('SET ROLE authenticated;');
    let threw = false;
    try {
      await client.query(`
        INSERT INTO public.event_sources (event_id, name, stream_type, stream_url)
        VALUES ('a0000000-0000-0000-0000-000000000001', 'Feed', 'hls', 'https://example.com/live.m3u8');
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true);
  });

  // 5. Admin allowlist table: browser roles cannot SELECT, INSERT, UPDATE, or DELETE admin_users
  await runTest('Security: "anon" has ZERO permissions on public.admin_users', async (client) => {
    await client.query('SET ROLE anon;');
    let threw = false;
    try {
      await client.query('SELECT * FROM public.admin_users;');
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true);
  });

  await runTest('Security: "authenticated" has ZERO permissions on public.admin_users', async (client) => {
    await client.query('SET ROLE authenticated;');
    let threw = false;
    try {
      await client.query('SELECT * FROM public.admin_users;');
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true);
  });

  // 6. Direct RPC Execution: anon cannot execute create_event_atomic or update_event_atomic
  await runTest('Security: "anon" cannot execute create_event_atomic or update_event_atomic', async (client) => {
    await client.query('SET ROLE anon;');
    let threw = false;
    try {
      await client.query(`
        SELECT public.create_event_atomic(
          'Title', 'slug', 'Desc', 'Cat', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
        );
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true);
  });

  await runTest('Security: "authenticated" cannot execute create_event_atomic or update_event_atomic', async (client) => {
    await client.query('SET ROLE authenticated;');
    let threw = false;
    try {
      await client.query(`
        SELECT public.create_event_atomic(
          'Title', 'slug', 'Desc', 'Cat', NULL, now(), NULL, 'draft', 'upcoming', NULL, '[]'::jsonb
        );
      `);
    } catch (err: any) {
      threw = true;
      assert.equal(err.code, '42501');
    }
    assert.equal(threw, true);
  });

  // 7. RLS: anon can read published events but NOT drafts
  await runTest('RLS: "anon" can read published events but cannot read draft events', async (client) => {
    // 1. Setup events as service_role inside a transaction so published source constraint is satisfied
    await client.query('SET ROLE service_role;');
    await client.query('BEGIN;');
    await client.query('DELETE FROM public.events;');
    await client.query(`
      INSERT INTO public.events (id, title, slug, publication_status, start_time)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'Published Derby', 'published-derby', 'published', now()),
        ('00000000-0000-0000-0000-000000000002', 'Secret Draft', 'secret-draft', 'draft', now());
    `);
    await client.query(`
      INSERT INTO public.event_sources (event_id, name, stream_type, stream_url, is_primary, display_order)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'Published Feed', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0);
    `);
    await client.query('COMMIT;');

    // 2. Query as anon
    await client.query('SET ROLE anon;');
    const res = await client.query('SELECT slug, publication_status FROM public.events ORDER BY slug;');
    assert.equal(res.rows.length, 1, `Expected anon to see exactly 1 event, saw ${res.rows.length}`);
    assert.equal(res.rows[0].slug, 'published-derby');
  });

  // 8. RLS: anon can read sources for published events but NOT for drafts
  await runTest('RLS: "anon" can read sources for published events only', async (client) => {
    await client.query('SET ROLE service_role;');
    await client.query('BEGIN;');
    await client.query(`
      INSERT INTO public.event_sources (event_id, name, stream_type, stream_url, is_primary, display_order)
      VALUES
        ('00000000-0000-0000-0000-000000000002', 'Draft Feed', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 0);
    `);
    await client.query('COMMIT;');

    await client.query('SET ROLE anon;');
    const res = await client.query('SELECT name FROM public.event_sources;');
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].name, 'Published Feed');
  });

  // 9. Privilege Matrix Verification
  await runTest('Privilege Matrix: Function execute permissions match exact matrix', async (client) => {
    const res = await client.query(`
      SELECT p.proname, r.rolname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN pg_roles r
      WHERE n.nspname = 'public'
        AND p.proname IN ('create_event_atomic', 'update_event_atomic')
        AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
        AND r.rolname IN ('anon', 'authenticated', 'PUBLIC', 'service_role');
    `);

    const grantees = res.rows.map((row) => `${row.proname}:${row.rolname}`);
    assert.ok(grantees.includes('create_event_atomic:service_role'));
    assert.ok(grantees.includes('update_event_atomic:service_role'));
    assert.ok(!grantees.includes('create_event_atomic:anon'));
    assert.ok(!grantees.includes('create_event_atomic:authenticated'));
    assert.ok(!grantees.includes('create_event_atomic:PUBLIC'));
  });

  console.log(`\nDatabase Access Tests Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
