import assert from 'node:assert/strict';
import { GET as healthHandler } from '../app/api/health/route';
import { GET as eventsHandler } from '../app/api/events/route';
import { getEmbedUrl as getStandaloneEmbedUrl } from '../lib/supabase/events-query';

console.log('--- Running Application & Football Match Regression Tests ---');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

async function main() {
  // 1. Health endpoint
  await test('Health API route (/api/health) returns 200 OK', async () => {
    const res = await healthHandler();
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.status === 'ok' || json.status === 'healthy' || json.uptime !== undefined);
  });

  // 2. Events API endpoint
  await test('Events API route (/api/events) returns 200 with events array', async () => {
    const res = await eventsHandler();
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.events));
  });

  // 3. Vicecap player embed URL formatting
  await test('Vicecap player embed URL formatter constructs valid embed URLs', () => {
    const ytSource = { stream_type: 'youtube' as const, stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
    const ytEmbed = getStandaloneEmbedUrl(ytSource);
    assert.equal(
      ytEmbed,
      'https://vicecap.github.io/Play/embed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&type=youtube'
    );

    const hlsSource = { stream_type: 'hls' as const, stream_url: 'https://example.com/live/master.m3u8' };
    const hlsEmbed = getStandaloneEmbedUrl(hlsSource);
    assert.equal(
      hlsEmbed,
      'https://vicecap.github.io/Play/embed?url=https%3A%2F%2Fexample.com%2Flive%2Fmaster.m3u8&type=hls'
    );
  });

  // 4. Verify existing match buttons route structure remains untouched
  await test('Existing match buttons route file exists and preserves Vicecap embed logic', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('app/api/match-buttons/[matchId]/route.ts', 'utf8');
    assert.ok(content.includes('vicecap.github.io/Play/embed'));
    assert.ok(content.includes('fixture='));
    assert.ok(content.includes('stream='));
  });

  // 5. Verify existing livescore route file exists and has GET handler
  await test('Existing livescore route file exists and has GET handler', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('app/api/livescore/route.ts', 'utf8');
    assert.ok(content.includes('export async function GET'));
  });

  // 6. Verify existing commentary route file exists and has GET handler
  await test('Existing commentary route file exists and has GET handler', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('app/api/commentary/[matchId]/route.ts', 'utf8');
    assert.ok(content.includes('export async function GET'));
  });

  // 7. Verify existing highlights route file exists and has GET handler
  await test('Existing highlights route file exists and has GET handler', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('app/api/highlights/route.ts', 'utf8');
    assert.ok(content.includes('export async function GET'));
  });

  console.log(`\nFootball Regression Tests Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal regression runner error:', err);
  process.exit(1);
});
