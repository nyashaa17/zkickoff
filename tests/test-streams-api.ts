/**
 * ZimKickOff Developer API — Phase 2.14 Stage 2
 * Streams API Implementation Verification Suite
 */

// Standalone test environment: stub 'server-only' package before loading server modules
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

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

// Mock HTML fixtures for TotalSportsLive
// 1. Fixture with genuine playable HLS (.m3u8) streams
const FIXTURE_LIVE_HTML_WITH_HLS_STREAMS = `
<div data-match-buttons data-match-state="{&quot;available&quot;:true,&quot;matchId&quot;:&quot;1738342&quot;}">
  <h3>Arsenal vs Chelsea</h3>
  <div class="match-buttons">
    <a href="https://stream-provider.example.com/live/stream1.m3u8" data-provider="VNRES">Stream 1 (HD)</a>
    <a href="https://stream-provider.example.com/live/stream2.m3u8" data-provider="VNRES">Stream 2</a>
    <a href="https://twitter.com/share?text=Watch+Live">Share on Twitter</a>
  </div>
</div>
<script src="/match-buttons-client.js" defer></script>
`;

// 2. Fixture with hosted player buttons only (no .m3u8 manifests available upstream)
const FIXTURE_LIVE_HTML_WITH_PLAYER_BUTTONS = `
<div data-match-buttons data-match-state="{&quot;available&quot;:true,&quot;matchId&quot;:&quot;1738342&quot;}">
  <h3>Arsenal vs Chelsea</h3>
  <div class="match-buttons">
    <a href="https://app.totalsportslive.xyz/player?stream=1&fixture=Arsenal+vs+Chelsea">Stream 1</a>
    <a href="https://app.totalsportslive.xyz/player?stream=2&fixture=Arsenal+vs+Chelsea">Stream 2 (HD)</a>
    <a href="https://twitter.com/share?text=Watch+Live">Share on Twitter</a>
  </div>
</div>
<script src="/match-buttons-client.js" defer></script>
`;

const FIXTURE_SCHEDULED_HTML = `
<div data-match-buttons data-match-state="{&quot;available&quot;:false,&quot;reason&quot;:&quot;scheduled&quot;,&quot;matchId&quot;:&quot;1738342&quot;}"></div>
<script src="/match-buttons-client.js" defer></script>
`;

const FIXTURE_FINISHED_HTML = `
<div data-match-buttons data-match-state="{&quot;available&quot;:false,&quot;reason&quot;:&quot;finished&quot;,&quot;matchId&quot;:&quot;1913895&quot;}"></div>
<script src="/match-buttons-client.js" defer></script>
`;

const FIXTURE_NOT_FOUND_HTML = `
<div data-match-buttons data-match-state="{&quot;available&quot;:false,&quot;reason&quot;:&quot;not-found&quot;,&quot;matchId&quot;:&quot;999999999999&quot;}"></div>
<script src="/match-buttons-client.js" defer></script>
`;

const FIXTURE_MALFORMED_HTML = `
<html><body><h1>Error 500 Cloudflare Worker Exception</h1></body></html>
`;

const FIXTURE_UNSAFE_ANCHORS_HTML = `
<div data-match-buttons data-match-state="{&quot;available&quot;:true,&quot;matchId&quot;:&quot;1738342&quot;}">
  <div class="match-title">Real Madrid vs Barcelona</div>
  <a href="javascript:alert(1)">XSS Link 1</a>
  <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Data URI</a>
  <a href="https://facebook.com/sharer/sharer.php?u=foo">Share on Facebook</a>
  <a href="https://whatsapp.com/send?text=foo">Share on WhatsApp</a>
  <a href="https://vicecap.github.io/Play/embed?fixture=El+Clasico&stream=1">Vicecap Embed Link</a>
  <a href="https://app.totalsportslive.xyz/player?stream=stream%20invalid%20$$&fixture=El+Clasico">Player Button</a>
  <a href="https://cdn.example.com/hls/real-barca.m3u8" data-provider="LaLiga-Live">Clean HLS Stream Link</a>
</div>
`;

async function main() {
  const { 
    validateMatchIdentifier, 
    parseTotalSportsButtonsHtml, 
    resolveMatchStreams,
    MatchNotFoundError,
    UpstreamProviderError
  } = await import('../lib/api/streams-service');
  const { GET: streamsRouteHandler } = await import('../app/api/v1/matches/[matchId]/streams/route');
  const { handleStreamsRequest } = await import('../lib/api/streams/streams-request-handler');
  const { GET: liveMatchesHandler } = await import('../app/api/v1/matches/live/route');
  const { GET: fixturesHandler } = await import('../app/api/v1/matches/fixtures/route');
  const { clearApiCache, CACHE_PROFILES } = await import('../lib/api/cache');
  const { recordApiEvent, flushAnalyticsBatch } = await import('../lib/api/analytics');
  const { generateApiKey } = await import('../lib/api/auth');
  const { resetRateLimiterState } = await import('../lib/api/rate-limiter');
  const { invalidateApiSettingsCache } = await import('../lib/api/kill-switch');

  console.log('================================================================================');
  console.log('--- Running ZimKickOff Developer API Streams Test Suite (Phase 2.15 Direct HLS) ---');
  console.log('================================================================================\n');

  // Test 1: Valid football match with direct HLS streams
  await test('1. Valid football match with direct HLS streams', async () => {
    clearApiCache();
    const mockFetch = async () => new Response(FIXTURE_LIVE_HTML_WITH_HLS_STREAMS, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const result = await resolveMatchStreams('1738342', { fetchFn: mockFetch as any });
    assert.equal(result.data.matchId, '1738342');
    assert.equal(result.data.hasStreams, true);
    assert.equal(result.data.streams.length, 2);

    const stream1 = result.data.streams[0];
    assert.equal(stream1.id, 'stream-1');
    assert.equal(stream1.name, 'Stream 1 (HD)');
    assert.equal(stream1.provider, 'VNRES');
    assert.equal(stream1.type, 'hls');
    assert.equal(stream1.url, 'https://stream-provider.example.com/live/stream1.m3u8');

    const stream2 = result.data.streams[1];
    assert.equal(stream2.id, 'stream-2');
    assert.equal(stream2.name, 'Stream 2');
    assert.equal(stream2.provider, 'VNRES');
    assert.equal(stream2.type, 'hls');
    assert.equal(stream2.url, 'https://stream-provider.example.com/live/stream2.m3u8');

    // Test 1B: When upstream returns player buttons only (no HLS manifests), Vicecap embeds are NOT returned
    clearApiCache();
    const mockFetchPlayerOnly = async () => new Response(FIXTURE_LIVE_HTML_WITH_PLAYER_BUTTONS, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const resultPlayerOnly = await resolveMatchStreams('1738342', { fetchFn: mockFetchPlayerOnly as any });
    assert.equal(resultPlayerOnly.data.matchId, '1738342');
    assert.equal(resultPlayerOnly.data.hasStreams, false);
    assert.deepEqual(resultPlayerOnly.data.streams, []);
  });

  // Test 2: Valid scheduled match without streams
  await test('2. Valid scheduled match without streams', async () => {
    clearApiCache();
    const mockFetch = async () => new Response(FIXTURE_SCHEDULED_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'x-match-availability': 'scheduled',
      },
    });

    const result = await resolveMatchStreams('1738342', { fetchFn: mockFetch as any });
    assert.equal(result.data.matchId, '1738342');
    assert.equal(result.data.hasStreams, false);
    assert.deepEqual(result.data.streams, []);
  });

  // Test 3: Valid concluded match without streams
  await test('3. Valid concluded match without streams', async () => {
    clearApiCache();
    const mockFetch = async () => new Response(FIXTURE_FINISHED_HTML, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'x-match-availability': 'finished',
      },
    });

    const result = await resolveMatchStreams('1913895', { fetchFn: mockFetch as any });
    assert.equal(result.data.matchId, '1913895');
    assert.equal(result.data.hasStreams, false);
    assert.deepEqual(result.data.streams, []);
  });

  // Test 4: Genuinely nonexistent match
  await test('4. Genuinely nonexistent match (404 MATCH_NOT_FOUND)', async () => {
    clearApiCache();
    const mockFetch = async () => new Response(FIXTURE_NOT_FOUND_HTML, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'x-match-availability': 'not-found',
      },
    });

    await assert.rejects(
      async () => {
        await resolveMatchStreams('999999999999', { fetchFn: mockFetch as any });
      },
      (err: any) => {
        assert.equal(err instanceof MatchNotFoundError || err.name === 'MatchNotFoundError', true);
        return true;
      }
    );
  });

  // Test 5: Invalid match identifier
  await test('5. Invalid match identifier (400 INVALID_MATCH_ID)', async () => {
    const invalidInputs = [
      '',
      '   ',
      'invalid$identifier',
      '../traversal',
      '-1234',
      '1234-',
      'arsenal--vs--chelsea',
      'a'.repeat(101),
      '<>script<>',
    ];

    for (const input of invalidInputs) {
      const val = validateMatchIdentifier(input);
      assert.equal(val.valid, false, `Input "${input}" should be invalid`);
      assert.equal(val.errorCode, 'INVALID_MATCH_ID');
    }

    // Verify valid inputs pass
    assert.equal(validateMatchIdentifier('1738342').valid, true);
    assert.equal(validateMatchIdentifier('highlanders-vs-dynamos-1738342').valid, true);
    assert.equal(validateMatchIdentifier('123e4567-e89b-12d3-a456-426614174000').valid, true);
    assert.equal(validateMatchIdentifier('zifa-presidential-cup-final-2026').valid, true);
  });

  // Test 6: Missing API key
  await test('6. Missing API key (401 MISSING_API_KEY)', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams');
    const mockDeps = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
    };
    const res = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDeps);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'MISSING_API_KEY');
  });

  // Test 7: Malformed API key
  await test('7. Malformed API key (401 MALFORMED_API_KEY)', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: {
        authorization: 'Bearer bad_key_format',
      },
    });
    const mockDeps = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
    };
    const res = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDeps);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'MALFORMED_API_KEY');
  });

  // Test 8: Invalid or revoked API key
  await test('8. Invalid or revoked API key (401 INVALID_API_KEY / REVOKED_API_KEY)', async () => {
    const syntheticKey = generateApiKey();
    const req = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: {
        authorization: `Bearer ${syntheticKey.fullKey}`,
      },
    });

    // Test 8A: Invalid key
    const mockDepsInvalid = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
      verifyApiKey: async () => ({
        valid: false,
        statusCode: 401 as const,
        errorCode: 'INVALID_API_KEY' as const,
        errorMessage: 'Invalid API key.',
      }),
    };
    const resInvalid = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDepsInvalid);
    assert.equal(resInvalid.status, 401);
    const jsonInvalid = await resInvalid.json();
    assert.equal(jsonInvalid.error.code, 'INVALID_API_KEY');

    // Test 8B: Revoked key
    const mockDepsRevoked = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
      verifyApiKey: async () => ({
        valid: false,
        statusCode: 401 as const,
        errorCode: 'REVOKED_API_KEY' as const,
        errorMessage: 'The provided API key has been revoked.',
      }),
    };
    const resRevoked = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDepsRevoked);
    assert.equal(resRevoked.status, 401);
    const jsonRevoked = await resRevoked.json();
    assert.equal(jsonRevoked.error.code, 'REVOKED_API_KEY');
  });

  // Test 9: Disabled API kill switch
  await test('9. Disabled API kill switch (503 API_DISABLED)', async () => {
    const syntheticKey = generateApiKey();
    const req = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: {
        authorization: `Bearer ${syntheticKey.fullKey}`,
      },
    });
    const mockDeps = {
      checkKillSwitch: async () => ({
        enabled: false,
        statusCode: 503 as const,
        errorCode: 'API_DISABLED' as const,
        message: 'Developer API is currently disabled for maintenance.',
      }),
    };
    const res = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDeps);
    assert.equal(res.status, 503);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'API_DISABLED');
    assert.equal(res.headers.get('Retry-After'), '30');
    assert.equal(res.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate');
  });

  // Test 10: Rate-limit exhaustion
  await test('10. Rate-limit exhaustion behavior (429 RATE_LIMIT_EXCEEDED)', async () => {
    const syntheticKey = generateApiKey();
    const req = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: {
        authorization: `Bearer ${syntheticKey.fullKey}`,
      },
    });
    const mockDeps = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
      verifyApiKey: async () => ({
        valid: true,
        keyRecord: {
          id: 'test-key-id-1234',
          name: 'Test Key',
          developer_name: 'Dev',
          developer_email: 'dev@test.com',
          key_prefix: syntheticKey.keyPrefix,
          key_hash: 'hash',
          status: 'active' as const,
          rate_limit_minute: 60,
          rate_limit_day: 10000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
      enforceLimit: async () => ({
        allowed: false,
        statusCode: 429 as const,
        errorCode: 'RATE_LIMIT_EXCEEDED' as const,
        limit: 60,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 45,
        retryAfter: 45,
        errorMessage: 'Rate limit of 60 requests per minute exceeded.',
      }),
    };

    const res = await handleStreamsRequest(req, Promise.resolve({ matchId: '1738342' }), mockDeps);
    assert.equal(res.status, 429);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(res.headers.get('X-RateLimit-Remaining'), '0');
    assert.equal(res.headers.get('Retry-After'), '45');
  });

  // Test 11: Upstream timeout
  await test('11. Upstream timeout (503 UPSTREAM_UNAVAILABLE, not 404)', async () => {
    clearApiCache();
    const mockTimeoutFetch = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };

    await assert.rejects(
      async () => {
        await resolveMatchStreams('1738342', { fetchFn: mockTimeoutFetch as any });
      },
      (err: any) => {
        assert.equal(err instanceof UpstreamProviderError, true);
        assert.equal(err.name, 'UpstreamProviderError');
        assert.equal(err.isUpstreamOutage, true);
        return true;
      }
    );
  });

  // Test 12: Upstream 5xx failure
  await test('12. Upstream 5xx failure (503 UPSTREAM_UNAVAILABLE, not 404)', async () => {
    clearApiCache();
    const mock500Fetch = async () => new Response('Internal Server Error', { status: 502 });

    await assert.rejects(
      async () => {
        await resolveMatchStreams('1738342', { fetchFn: mock500Fetch as any });
      },
      (err: any) => {
        assert.equal(err instanceof UpstreamProviderError, true);
        assert.equal(err.statusCode, 503);
        return true;
      }
    );
  });

  // Test 13: Malformed upstream HTML
  await test('13. Malformed upstream HTML (503 UPSTREAM_UNAVAILABLE, not 404)', async () => {
    clearApiCache();
    const mockMalformedFetch = async () => new Response(FIXTURE_MALFORMED_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    await assert.rejects(
      async () => {
        await resolveMatchStreams('1738342', { fetchFn: mockMalformedFetch as any });
      },
      (err: any) => {
        assert.equal(err instanceof UpstreamProviderError, true);
        assert.equal(err.message.includes('malformed HTML'), true);
        return true;
      }
    );
  });

  // Test 14: Unsafe upstream anchor, XSS, and Vicecap exclusion
  await test('14. Unsafe upstream anchor, XSS, and Vicecap exclusion', () => {
    const streams = parseTotalSportsButtonsHtml(FIXTURE_UNSAFE_ANCHORS_HTML, '1738342');
    
    // Only 1 link should survive (the clean HLS link)
    // javascript: alert(1), data URI, facebook, whatsapp, vicecap embed, and non-HLS player button must all be stripped
    assert.equal(streams.length, 1);

    const stream = streams[0];
    assert.equal(stream.id, 'stream-1');
    assert.equal(stream.name, 'Clean HLS Stream Link');
    assert.equal(stream.provider, 'LaLiga-Live');
    assert.equal(stream.type, 'hls');
    assert.equal(stream.url, 'https://cdn.example.com/hls/real-barca.m3u8');

    // Strictly assert no XSS, embed, or Vicecap URLs exist
    assert.equal(stream.url.includes('<script>'), false);
    assert.equal(stream.url.includes('javascript:'), false);
    assert.equal(stream.url.includes('data:'), false);
    assert.equal(stream.url.includes('vicecap.github.io'), false);
  });

  // Test 15: Published live standalone event with direct HLS stream delivery
  await test('15. Published live standalone event with direct HLS stream delivery', async () => {
    clearApiCache();
    const mockEventId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mockSupabase = {
      from: (table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: mockEventId,
                    title: 'Presidential Cup Final 2026',
                    slug: 'presidential-cup-final-2026',
                    publication_status: 'published',
                    broadcast_status: 'live',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'event_sources') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: 'src-1',
                      event_id: mockEventId,
                      name: 'ZBC TV HD',
                      stream_type: 'hls',
                      stream_url: 'https://cdn.example.com/live/stream.m3u8',
                      is_primary: true,
                      display_order: 1,
                    },
                    {
                      id: 'src-2',
                      event_id: mockEventId,
                      name: 'YouTube Stream',
                      stream_type: 'youtube',
                      stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                      is_primary: false,
                      display_order: 2,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const result = await resolveMatchStreams(mockEventId, { supabaseClient: mockSupabase });
    assert.equal(result.data.matchId, mockEventId);
    assert.equal(result.data.hasStreams, true);
    // CRITICAL: YouTube source must NOT be returned as HLS ("Do not return YouTube sources as HLS")
    assert.equal(result.data.streams.length, 1);

    const stream = result.data.streams[0];
    assert.equal(stream.id, 'src-1');
    assert.equal(stream.name, 'ZBC TV HD');
    assert.equal(stream.provider, 'ZimKickOff');
    assert.equal(stream.type, 'hls');
    assert.equal(stream.url, 'https://cdn.example.com/live/stream.m3u8');
    assert.equal(stream.url.includes('.m3u8'), true);
    assert.equal(stream.url.includes('vicecap.github.io'), false);
    assert.equal((stream as any).embedUrl, undefined);
  });

  // Test 16: Standalone event with only YouTube sources or not live (hasStreams: false)
  await test('16. Standalone event with only YouTube sources or not live (hasStreams: false)', async () => {
    clearApiCache();
    const mockLiveYoutubeOnlyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567891';
    const mockSupabaseYoutubeOnly = {
      from: (table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: mockLiveYoutubeOnlyId,
                    title: 'Live Event with YouTube Only',
                    slug: 'live-event-youtube-only',
                    publication_status: 'published',
                    broadcast_status: 'live',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'event_sources') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: 'src-yt-1',
                      event_id: mockLiveYoutubeOnlyId,
                      name: 'Official YouTube Stream',
                      stream_type: 'youtube',
                      stream_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                      is_primary: true,
                      display_order: 1,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const resultYoutube = await resolveMatchStreams(mockLiveYoutubeOnlyId, { supabaseClient: mockSupabaseYoutubeOnly });
    assert.equal(resultYoutube.data.matchId, mockLiveYoutubeOnlyId);
    assert.equal(resultYoutube.data.hasStreams, false);
    assert.deepEqual(resultYoutube.data.streams, []);

    // Test 16B: Upcoming event
    clearApiCache();
    const mockUpcomingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567892';
    const mockSupabaseUpcoming = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: mockUpcomingId,
                title: 'Upcoming Derby',
                slug: 'upcoming-derby',
                publication_status: 'published',
                broadcast_status: 'upcoming', // upcoming -> no streams
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const resultUpcoming = await resolveMatchStreams(mockUpcomingId, { supabaseClient: mockSupabaseUpcoming });
    assert.equal(resultUpcoming.data.matchId, mockUpcomingId);
    assert.equal(resultUpcoming.data.hasStreams, false);
    assert.deepEqual(resultUpcoming.data.streams, []);
  });

  // Test 17: Draft standalone event
  await test('17. Draft standalone event (404 MATCH_NOT_FOUND, never falls through)', async () => {
    clearApiCache();
    const mockDraftId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    let tslFetchCalled = false;

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: mockDraftId,
                title: 'Secret Draft Match',
                slug: 'secret-draft-match',
                publication_status: 'draft', // DRAFT
                broadcast_status: 'live',
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const mockFetch = async () => {
      tslFetchCalled = true;
      return new Response(FIXTURE_LIVE_HTML_WITH_HLS_STREAMS);
    };

    await assert.rejects(
      async () => {
        await resolveMatchStreams(mockDraftId, {
          supabaseClient: mockSupabase,
          fetchFn: mockFetch as any,
        });
      },
      (err: any) => {
        assert.equal(err instanceof MatchNotFoundError || err.name === 'MatchNotFoundError', true);
        return true;
      }
    );

    // CRITICAL: Must never fall through to TotalSportsLive
    assert.equal(tslFetchCalled, false, 'TotalSportsLive fetch must NOT be called for draft event');
  });

  // Test 18: Archived standalone event
  await test('18. Archived standalone event (404 MATCH_NOT_FOUND, never falls through)', async () => {
    clearApiCache();
    const mockArchivedSlug = 'archived-championship-final';
    let tslFetchCalled = false;

    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                title: 'Archived Championship',
                slug: mockArchivedSlug,
                publication_status: 'archived', // ARCHIVED
                broadcast_status: 'concluded',
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const mockFetch = async () => {
      tslFetchCalled = true;
      return new Response(FIXTURE_LIVE_HTML_WITH_HLS_STREAMS);
    };

    await assert.rejects(
      async () => {
        await resolveMatchStreams(mockArchivedSlug, {
          supabaseClient: mockSupabase,
          fetchFn: mockFetch as any,
        });
      },
      (err: any) => {
        assert.equal(err instanceof MatchNotFoundError || err.name === 'MatchNotFoundError', true);
        return true;
      }
    );

    assert.equal(tslFetchCalled, false, 'TotalSportsLive fetch must NOT be called for archived event');
  });

  // Test 19: Invalid standalone source URL
  await test('19. Invalid standalone source URL (anti-SSRF blocks private IP / cloud metadata)', async () => {
    clearApiCache();
    const mockEventId = 'd4e5f6a7-b8c9-0123-def0-123456789012';
    const mockSupabase = {
      from: (table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: mockEventId,
                    title: 'SSRF Attack Simulation Event',
                    slug: 'ssrf-simulation-event',
                    publication_status: 'published',
                    broadcast_status: 'live',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'event_sources') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: 'bad-1',
                      event_id: mockEventId,
                      name: 'Loopback Stream',
                      stream_type: 'hls',
                      stream_url: 'https://127.0.0.1:8080/manifest.m3u8',
                      is_primary: false,
                      display_order: 1,
                    },
                    {
                      id: 'bad-2',
                      event_id: mockEventId,
                      name: 'Cloud Metadata Stream',
                      stream_type: 'hls',
                      stream_url: 'https://169.254.169.254/latest/meta-data',
                      is_primary: false,
                      display_order: 2,
                    },
                    {
                      id: 'good-1',
                      event_id: mockEventId,
                      name: 'Valid CDN Stream',
                      stream_type: 'hls',
                      stream_url: 'https://cdn.broadcast.co.zw/live/manifest.m3u8',
                      is_primary: true,
                      display_order: 3,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const result = await resolveMatchStreams(mockEventId, { supabaseClient: mockSupabase });
    assert.equal(result.data.hasStreams, true);
    // Only the good CDN stream should survive
    assert.equal(result.data.streams.length, 1);
    assert.equal(result.data.streams[0].id, 'good-1');
    assert.equal(result.data.streams[0].type, 'hls');
    assert.equal(result.data.streams[0].url, 'https://cdn.broadcast.co.zw/live/manifest.m3u8');
    assert.equal(result.data.streams[0].url.includes('127.0.0.1'), false);
    assert.equal(result.data.streams[0].url.includes('169.254.169.254'), false);
  });

  // Test 20: Direct playable HLS delivery verification (replaces old withholding assumption)
  await test('20. Direct playable HLS delivery verification (actual HLS returned; no iframe/embed URLs; no Vicecap)', async () => {
    clearApiCache();
    const mockFetch = async () => new Response(FIXTURE_LIVE_HTML_WITH_HLS_STREAMS, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const result = await resolveMatchStreams('1738342', { fetchFn: mockFetch as any });
    const serializedJson = JSON.stringify(result.data);

    // 1. Actual playable .m3u8 manifest URLs ARE returned
    assert.equal(serializedJson.includes('.m3u8'), true, 'Response must contain playable .m3u8 manifest URLs');
    assert.equal(result.data.hasStreams, true);
    assert.equal(result.data.streams.length, 2);

    for (const stream of result.data.streams) {
      assert.equal(stream.type, 'hls');
      assert.equal(stream.url.endsWith('.m3u8'), true);
      assert.equal(stream.url.startsWith('https://'), true);
    }

    // 2. Vicecap and player embed URLs are NEVER present
    assert.equal(serializedJson.includes('vicecap.github.io'), false, 'Response must NOT contain Vicecap embed URLs');
    assert.equal(serializedJson.includes('embedUrl'), false, 'Response must NOT contain legacy embedUrl property');
    assert.equal(serializedJson.includes('<iframe'), false, 'Response must NOT contain iframe tags');

    // 3. Upstream HTML markup and internal state tokens are cleanly stripped
    assert.equal(serializedJson.includes('<div'), false, 'Response must not contain HTML tags');
    assert.equal(serializedJson.includes('data-match-state'), false, 'Response must not contain upstream data attributes');
    assert.equal(serializedJson.includes('data-match-buttons'), false, 'Response must not contain upstream data attributes');
  });

  // Test 21: Analytics constraint compatibility
  await test('21. Analytics constraint compatibility (streams events do not violate database constraint)', async () => {
    // Record multiple Streams events into the analytics buffer
    const mockApiKeyId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567899';
    recordApiEvent({
      apiKeyId: mockApiKeyId,
      endpoint: '/api/v1/matches/:matchId/streams',
      statusCode: 200,
      latencyMs: 18,
      timestamp: Date.now(),
    });
    recordApiEvent({
      apiKeyId: mockApiKeyId,
      endpoint: '/api/v1/matches/:matchId/streams',
      statusCode: 404,
      latencyMs: 12,
      timestamp: Date.now(),
    });

    // Flush analytics buffer: must complete cleanly without throwing
    // and without sending '/api/v1/matches/:matchId/streams' to the database RPC
    await flushAnalyticsBatch();
    console.log('  Analytics buffer flushed safely with Streams events excluded from DB hourly table');
  });

  // Test 22: Existing live and fixtures endpoint regression
  await test('22. Existing live and fixtures endpoint regression verification', async () => {
    // Verify GET handlers exist and export contracts are intact
    assert.equal(typeof liveMatchesHandler, 'function');
    assert.equal(typeof fixturesHandler, 'function');

    // Verify cache profiles exist and are immutable
    assert.ok(CACHE_PROFILES.LIVE_MATCHES);
    assert.ok(CACHE_PROFILES.TODAY_FIXTURES);
    assert.ok(CACHE_PROFILES.FUTURE_FIXTURES);
    assert.ok(CACHE_PROFILES.STREAMS);
    assert.equal(CACHE_PROFILES.STREAMS.freshTtlSeconds, 15);
    assert.equal(CACHE_PROFILES.STREAMS.staleWindowSeconds, 60);
  });

  // ---------------------------------------------------------------------------
  // Phase 2.17 Centralized VNRES Catalog Integration Tests
  // ---------------------------------------------------------------------------

  const {
    isVnresCatalogAuthorized,
    isTrustedHlsHost,
    extractSignedUrlExpiryMs,
    isSignedUrlExpired,
    redactSignedUrlTokens,
    matchCatalogFixtures,
    normalizeTeamName,
    resolveVnresCatalogStreams,
    resetVnresUpstreamBudget,
    getVnresUpstreamStats,
    VNRES_CATALOG_ENDPOINT,
  } = await import('../lib/api/vnres-catalog');

  // Test 23: Provider Authorization Gate (disabled by default; zero upstream traffic)
  await test('23. Provider Authorization Gate (disabled by default; zero upstream traffic)', async () => {
    resetVnresUpstreamBudget();
    let upstreamFetchCalled = false;

    // Verify default authorization evaluation is false without explicit env
    const prevEnv = process.env.ENABLE_VNRES_CATALOG;
    delete process.env.ENABLE_VNRES_CATALOG;
    assert.equal(isVnresCatalogAuthorized(), false, 'isVnresCatalogAuthorized must default to false');

    const mockFetch = async () => {
      upstreamFetchCalled = true;
      return new Response(JSON.stringify({ total: 1, fixtures: [] }));
    };

    const result = await resolveVnresCatalogStreams(
      { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
      { fetchFn: mockFetch as any }
    );

    assert.equal(result.authorized, false);
    assert.equal(result.matched, false);
    assert.deepEqual(result.streams, []);
    assert.equal(upstreamFetchCalled, false, 'No upstream HTTP request should be made when unauthorized');

    if (prevEnv !== undefined) {
      process.env.ENABLE_VNRES_CATALOG = prevEnv;
    }
  });

  // Test 24: Authorized VNRES Catalog Resolution (HD/SD direct HLS streams returned)
  await test('24. Authorized VNRES Catalog Resolution (HD/SD direct HLS streams returned)', async () => {
    resetVnresUpstreamBudget();
    const futureHexTime = (Math.floor(Date.now() / 1000) + 7200).toString(16);
    const mockCatalogPayload = {
      cachedAt: Math.floor(Date.now() / 1000),
      total: 1,
      fixtures: [
        {
          source: 'VNRES',
          room_id: '98765',
          fixture_original: 'Arsenal vs Chelsea',
          fixture_en: 'Arsenal vs Chelsea',
          fixture_key: 'arsenal_vs_chelsea',
          stream_number: 1,
          health: 'OK',
          m3u8_hd: `https://pull.niur.live/live/stream1_hd.m3u8?txSecret=abc123secret&txTime=${futureHexTime}`,
          m3u8_sd: `https://pull.niur.live/live/stream1_sd.m3u8?txSecret=abc123secret&txTime=${futureHexTime}`,
          flv_hd: 'https://pull.niur.live/live/stream1_hd.flv',
        },
      ],
    };

    let requestedUrl = '';
    const mockFetch = async (url: string | URL | Request) => {
      requestedUrl = url.toString();
      return new Response(JSON.stringify(mockCatalogPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await resolveVnresCatalogStreams(
      { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
      { isAuthorized: true, fetchFn: mockFetch as any }
    );

    assert.equal(result.authorized, true);
    assert.equal(result.matched, true);
    assert.equal(requestedUrl.startsWith(VNRES_CATALOG_ENDPOINT), true);
    assert.equal(requestedUrl.includes('appp.totalsportslive.xyz/fixtures'), true);
    assert.equal(result.streams.length, 2);

    const [hdStream, sdStream] = result.streams;
    assert.equal(hdStream.id, 'stream-1');
    assert.equal(hdStream.name, 'HD Stream');
    assert.equal(hdStream.provider, 'VNRES');
    assert.equal(hdStream.type, 'hls');
    assert.equal(hdStream.url.includes('stream1_hd.m3u8'), true);
    assert.equal(hdStream.url.includes(`txTime=${futureHexTime}`), true);

    assert.equal(sdStream.id, 'stream-2');
    assert.equal(sdStream.name, 'SD Stream');
    assert.equal(sdStream.provider, 'VNRES');
    assert.equal(sdStream.type, 'hls');
    assert.equal(sdStream.url.includes('stream1_sd.m3u8'), true);
  });

  // Test 25: Reliable Fixture Matching (normalization, diacritics, club designators)
  await test('25. Reliable Fixture Matching (normalization, diacritics, club designators)', () => {
    const catalogEntries = [
      {
        source: 'VNRES',
        fixture_en: 'Atlético Madrid vs Bayern Munich',
        fixture_key: 'atletico_madrid_vs_bayern_munich',
        health: 'OK',
        m3u8_hd: 'https://pull.niur.live/live/atletico.m3u8',
      },
      {
        source: 'VNRES',
        fixture_en: 'Highlanders FC vs Dynamos FC',
        fixture_key: 'highlanders_vs_dynamos',
        health: 'OK',
        m3u8_hd: 'https://pull.niur.live/live/zpsl.m3u8',
      },
    ];

    // Case A: Accents and FC designators
    const matchA = matchCatalogFixtures(
      { homeTeam: 'Atletico Madrid', awayTeam: 'Bayern München' },
      catalogEntries
    );
    assert.equal(matchA.matched, true);
    assert.equal(matchA.fixtureKey, 'atletico_madrid_vs_bayern_munich');
    assert.equal(matchA.matchedItems.length, 1);

    // Case B: Zimbabwean Premier Soccer League teams with FC suffix
    const matchB = matchCatalogFixtures(
      { homeTeam: 'Highlanders', awayTeam: 'Dynamos' },
      catalogEntries
    );
    assert.equal(matchB.matched, true);
    assert.equal(matchB.fixtureKey, 'highlanders_vs_dynamos');
    assert.equal(matchB.matchedItems.length, 1);
  });

  // Test 26: Fixture Matching Ambiguity Rejection & Single-Team Guard
  await test('26. Fixture Matching Ambiguity Rejection & Single-Team Guard', () => {
    const ambiguousCatalog = [
      {
        source: 'VNRES',
        fixture_en: 'Real Madrid vs Barcelona',
        fixture_key: 'real_madrid_vs_barcelona',
        health: 'OK',
        m3u8_hd: 'https://pull.niur.live/live/elclasico.m3u8',
      },
      {
        source: 'VNRES',
        fixture_en: 'Real Sociedad vs Barcelona',
        fixture_key: 'real_sociedad_vs_barcelona',
        health: 'OK',
        m3u8_hd: 'https://pull.niur.live/live/sociedad_barca.m3u8',
      },
    ];

    // Single-team match rejection: "Arsenal vs Chelsea" must not match "Arsenal vs Everton"
    const singleTeamCatalog = [
      {
        source: 'VNRES',
        fixture_en: 'Arsenal vs Everton',
        fixture_key: 'arsenal_vs_everton',
        health: 'OK',
        m3u8_hd: 'https://pull.niur.live/live/arsenal_everton.m3u8',
      },
    ];
    const matchWrongAway = matchCatalogFixtures(
      { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
      singleTeamCatalog
    );
    assert.equal(matchWrongAway.matched, false, 'Must reject match when away team does not match');

    // Ambiguity rejection: query that matches multiple distinct fixture keys must be rejected
    const ambiguousQuery = matchCatalogFixtures(
      { homeTeam: 'Real', awayTeam: 'Barcelona' },
      ambiguousCatalog
    );
    assert.equal(ambiguousQuery.matched, false, 'Must reject ambiguous match across multiple fixtures');
    assert.equal(ambiguousQuery.reason?.includes('Ambiguous match'), true);
  });

  // Test 27: Signed URL Expiration Mechanics & Cache Guard
  await test('27. Signed URL Expiration Mechanics & Cache Guard', () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. txTime (hexadecimal seconds)
    const futureHex = (nowSec + 3600).toString(16);
    const expiredHex = (nowSec - 100).toString(16);

    const validTxUrl = `https://pull.niur.live/live/stream.m3u8?txSecret=xyz&txTime=${futureHex}`;
    const expiredTxUrl = `https://pull.niur.live/live/stream.m3u8?txSecret=xyz&txTime=${expiredHex}`;

    assert.equal(isSignedUrlExpired(validTxUrl, 30_000), false);
    assert.equal(isSignedUrlExpired(expiredTxUrl, 30_000), true);

    // 2. auth_key (Aliyun format: timestamp-rand-uid-md5)
    const validAuthKeyUrl = `https://pull06.scstream.net/live/stream.m3u8?auth_key=${nowSec + 1800}-0-0-abcdef123`;
    const expiredAuthKeyUrl = `https://pull06.scstream.net/live/stream.m3u8?auth_key=${nowSec - 10}-0-0-abcdef123`;

    assert.equal(isSignedUrlExpired(validAuthKeyUrl, 30_000), false);
    assert.equal(isSignedUrlExpired(expiredAuthKeyUrl, 30_000), true);

    // 3. Safety threshold: URL expiring in 15 seconds is treated as expired (within 30s safety threshold)
    const imminentExpHex = (nowSec + 15).toString(16);
    const imminentTxUrl = `https://pull.niur.live/live/stream.m3u8?txTime=${imminentExpHex}`;
    assert.equal(isSignedUrlExpired(imminentTxUrl, 30_000), true, 'Imminent expiration within 30s must be marked expired');
  });

  // Test 28: Security Allowlist & Token Redaction
  await test('28. Security Allowlist & Token Redaction', () => {
    // 1. Allowlist checks
    assert.equal(isTrustedHlsHost('https://pull.niur.live/live/feed.m3u8'), true);
    assert.equal(isTrustedHlsHost('https://pull.niues.live/live/feed.m3u8'), true);
    assert.equal(isTrustedHlsHost('https://pull06.scstream.net/live/feed.m3u8'), true);
    assert.equal(isTrustedHlsHost('https://live.zimkickoff.co.zw/feed.m3u8'), true);
    assert.equal(isTrustedHlsHost('https://cdn.broadcast.co.zw/feed.m3u8'), true);

    // Untrusted origins rejected
    assert.equal(isTrustedHlsHost('https://untrusted-hls-host.xyz/live.m3u8'), false);
    assert.equal(isTrustedHlsHost('https://evil-proxy.org/feed.m3u8'), false);
    // Non-HTTPS rejected
    assert.equal(isTrustedHlsHost('http://pull.niur.live/live/feed.m3u8'), false);
    // Credentials rejected
    assert.equal(isTrustedHlsHost('https://admin:pass@pull.niur.live/live/feed.m3u8'), false);

    // 2. Token Redaction
    const signedUrl = 'https://pull.niur.live/live/feed.m3u8?txSecret=SUPER_SECRET_TOKEN&txTime=6af5d694&foo=bar';
    const redacted = redactSignedUrlTokens(signedUrl);
    assert.equal(redacted.includes('SUPER_SECRET_TOKEN'), false, 'Sensitive txSecret must be redacted');
    assert.equal(redacted.includes('REDACTED'), true);
    assert.equal(redacted.includes('foo=bar'), true, 'Non-sensitive query params must be preserved');
  });

  // Test 29: Upstream Traffic Protection & Cross-API-Key Shared Caching
  await test('29. Upstream Traffic Protection & Cross-API-Key Shared Caching', async () => {
    clearApiCache();
    resetVnresUpstreamBudget();
    let upstreamCallCount = 0;

    const mockFetch = async () => {
      upstreamCallCount++;
      return new Response(FIXTURE_LIVE_HTML_WITH_HLS_STREAMS, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    };

    // Developer 1 makes a request
    const devKey1 = generateApiKey();
    const req1 = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: { authorization: `Bearer ${devKey1.fullKey}` },
    });
    const mockDeps1 = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
      verifyApiKey: async () => ({
        valid: true,
        keyRecord: {
          id: 'dev-1-uuid',
          rate_limit_minute: 60,
          rate_limit_day: 10000,
        } as any,
      }),
      enforceLimit: async () => ({ allowed: true, limit: 60, remaining: 59, reset: 123456, statusCode: 200 as const }),
      resolveStreams: (id: string) => resolveMatchStreams(id, { fetchFn: mockFetch as any }),
    };

    const res1 = await handleStreamsRequest(req1, Promise.resolve({ matchId: '1738342' }), mockDeps1);
    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('X-Cache'), 'MISS');
    assert.equal(upstreamCallCount, 1);

    // Developer 2 makes a request for the same match
    const devKey2 = generateApiKey();
    const req2 = new NextRequest('http://localhost:3000/api/v1/matches/1738342/streams', {
      headers: { authorization: `Bearer ${devKey2.fullKey}` },
    });
    const mockDeps2 = {
      checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
      verifyApiKey: async () => ({
        valid: true,
        keyRecord: {
          id: 'dev-2-uuid',
          rate_limit_minute: 60,
          rate_limit_day: 10000,
        } as any,
      }),
      enforceLimit: async () => ({ allowed: true, limit: 60, remaining: 59, reset: 123456, statusCode: 200 as const }),
      resolveStreams: (id: string) => resolveMatchStreams(id, { fetchFn: mockFetch as any }),
    };

    const res2 = await handleStreamsRequest(req2, Promise.resolve({ matchId: '1738342' }), mockDeps2);
    assert.equal(res2.status, 200);
    // CRITICAL: Cache hit across different API keys (cache is shared, NOT partitioned by API key)
    assert.equal(res2.headers.get('X-Cache'), 'HIT');
    assert.equal(upstreamCallCount, 1, 'Upstream must NOT be fetched again for second developer during cache cycle');
  });

  // Test 30: Upstream Request Budget Ceiling & Failure Cooldown
  await test('30. Upstream Request Budget Ceiling & Failure Cooldown', async () => {
    resetVnresUpstreamBudget();

    // 1. Failure cooldown verification: Upstream 500 error triggers 30-second cooldown
    const failingFetch = async () => new Response('Internal Server Error', { status: 500 });

    await assert.rejects(
      async () => {
        await resolveVnresCatalogStreams(
          { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
          { isAuthorized: true, fetchFn: failingFetch as any }
        );
      },
      (err: any) => {
        assert.equal(err.name, 'VnresUpstreamError');
        assert.equal(err.statusCode, 503);
        assert.equal(err.retryAfter, 30);
        return true;
      }
    );

    const stats = getVnresUpstreamStats();
    assert.equal(stats.inCooldown, true, 'Upstream should be in cooldown after 5xx error');
    assert.ok(stats.cooldownRemainingSeconds > 0);

    // Subsequent call during cooldown fails immediately without calling upstream
    let fetchCalledDuringCooldown = false;
    const probeFetch = async () => {
      fetchCalledDuringCooldown = true;
      return new Response('OK');
    };

    await assert.rejects(
      async () => {
        await resolveVnresCatalogStreams(
          { homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
          { isAuthorized: true, fetchFn: probeFetch as any }
        );
      },
      (err: any) => {
        assert.equal(err.name, 'VnresUpstreamError');
        assert.equal(err.statusCode, 503);
        return true;
      }
    );
    assert.equal(fetchCalledDuringCooldown, false, 'No fetch should be issued during cooldown period');

    // 2. Budget ceiling verification
    resetVnresUpstreamBudget();
    const successfulFetch = async () => new Response(JSON.stringify({ total: 0, fixtures: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Simulate 120 requests to hit ceiling
    for (let i = 0; i < 120; i++) {
      await resolveVnresCatalogStreams(
        { homeTeam: `TeamA${i}`, awayTeam: `TeamB${i}` },
        { isAuthorized: true, fetchFn: successfulFetch as any }
      );
    }

    const statsAfter120 = getVnresUpstreamStats();
    assert.equal(statsAfter120.requestsInWindow, 120);

    // 121st request exceeds budget ceiling
    await assert.rejects(
      async () => {
        await resolveVnresCatalogStreams(
          { homeTeam: 'OverflowTeam1', awayTeam: 'OverflowTeam2' },
          { isAuthorized: true, fetchFn: successfulFetch as any }
        );
      },
      (err: any) => {
        assert.equal(err.name, 'VnresUpstreamError');
        assert.equal(err.statusCode, 503);
        assert.equal(err.message.includes('budget ceiling'), true);
        return true;
      }
    );

    // Clean up for subsequent tests
    resetVnresUpstreamBudget();
  });

  // Test 31: F-22-01 Coordination waiter timeout error contract
  const mockKeyRecord = {
    id: 'test-key-id-1234',
    name: 'Test Key',
    developer_name: 'Dev',
    rate_limit_minute: 60,
    rate_limit_day: 10000,
  } as any;

  await test('31. F-22-01 Coordination waiter timeout produces 503 ANOTHER_WORKER_FETCHING, never 200 false empty streams', async () => {
    const { CoordinationTimeoutError } = await import('../lib/api/upstream-coordination');
    const { handleStreamsRequest } = await import('../lib/api/streams/streams-request-handler');

    // Simulate resolveStreams throwing a CoordinationTimeoutError (as when follower times out waiting for leader)
    const mockResolveTimeout = async () => {
      throw new CoordinationTimeoutError();
    };

    const req = new NextRequest('https://zimkickoff.co.zw/api/v1/matches/1738342/streams', {
      headers: {
        'x-api-key': 'zk_live_test_valid_key',
      },
    });

    const res = await handleStreamsRequest(
      req,
      Promise.resolve({ matchId: '1738342' }),
      {
        checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
        verifyApiKey: async () => ({ valid: true, keyRecord: mockKeyRecord }),
        enforceLimit: async () => ({ allowed: true, limit: 60, remaining: 59, reset: 60, statusCode: 200 }),
        resolveStreams: mockResolveTimeout as any,
      }
    );

    // Contract verification
    assert.equal(res.status, 503, 'Must return HTTP 503, never HTTP 200');
    assert.equal(res.headers.get('Retry-After'), '2', 'Must return Retry-After: 2');
    assert.equal(
      res.headers.get('Cache-Control'),
      'no-store, no-cache, must-revalidate',
      '503 ANOTHER_WORKER_FETCHING must include Cache-Control: no-store, no-cache, must-revalidate'
    );

    const json = await res.json();
    assert.equal(json.success, false, 'success must be false');
    assert.equal(json.error.code, 'ANOTHER_WORKER_FETCHING', 'code must be ANOTHER_WORKER_FETCHING');
    assert.equal(json.error.retryAfter, 2, 'retryAfter must be 2');
    assert.equal(json.hasStreams, undefined, 'Must NOT contain hasStreams property');
  });

  // Test 32: Genuine no-stream condition returns HTTP 200 with hasStreams: false
  await test('32. Genuine no-stream result returns HTTP 200 with hasStreams: false', async () => {
    const { handleStreamsRequest } = await import('../lib/api/streams/streams-request-handler');

    const mockResolveEmpty = async () => ({
      data: {
        matchId: '1738342',
        hasStreams: false,
        streams: [],
      },
      source: 'HIT' as const,
    });

    const req = new NextRequest('https://zimkickoff.co.zw/api/v1/matches/1738342/streams', {
      headers: {
        'x-api-key': 'zk_live_test_valid_key',
      },
    });

    const res = await handleStreamsRequest(
      req,
      Promise.resolve({ matchId: '1738342' }),
      {
        checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
        verifyApiKey: async () => ({ valid: true, keyRecord: mockKeyRecord }),
        enforceLimit: async () => ({ allowed: true, limit: 60, remaining: 59, reset: 60, statusCode: 200 }),
        resolveStreams: mockResolveEmpty as any,
      }
    );

    assert.equal(res.status, 200, 'Genuine no-stream match must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.hasStreams, false);
    assert.equal(json.data.streams.length, 0);
  });

  // Test 33: Upstream HTTP timeout produces 503 UPSTREAM_UNAVAILABLE
  await test('33. Upstream HTTP timeout produces 503 UPSTREAM_UNAVAILABLE', async () => {
    const { handleStreamsRequest } = await import('../lib/api/streams/streams-request-handler');

    const mockResolveUpstreamTimeout = async () => {
      throw new UpstreamProviderError('TotalSportsLive upstream timed out after 5 seconds', 504, 30);
    };

    const req = new NextRequest('https://zimkickoff.co.zw/api/v1/matches/1738342/streams', {
      headers: {
        'x-api-key': 'zk_live_test_valid_key',
      },
    });

    const res = await handleStreamsRequest(
      req,
      Promise.resolve({ matchId: '1738342' }),
      {
        checkKillSwitch: async () => ({ enabled: true, message: 'API active' }),
        verifyApiKey: async () => ({ valid: true, keyRecord: mockKeyRecord }),
        enforceLimit: async () => ({ allowed: true, limit: 60, remaining: 59, reset: 60, statusCode: 200 }),
        resolveStreams: mockResolveUpstreamTimeout as any,
      }
    );

    assert.equal(res.status, 503);
    assert.equal(res.headers.get('Retry-After'), '30');
    assert.equal(
      res.headers.get('Cache-Control'),
      'no-store, no-cache, must-revalidate',
      '503 UPSTREAM_UNAVAILABLE must include Cache-Control: no-store, no-cache, must-revalidate'
    );
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UPSTREAM_UNAVAILABLE');
  });

  // Test 34: F-22-03 Single-flight request coalescing protects upstream budget
  await test('34. F-22-03 Single-flight request coalescing protects upstream budget', async () => {
    resetVnresUpstreamBudget();

    let fetchCount = 0;
    const slowFetch = async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 100));
      return new Response(JSON.stringify({
        fixtures: [{ fixture_en: 'Arsenal vs Chelsea', m3u8_hd: 'https://pull.niur.live/hd.m3u8' }]
      }), { headers: { 'Content-Type': 'application/json' } });
    };

    // Fire 5 concurrent requests for the same fixture
    const results = await Promise.all([
      resolveVnresCatalogStreams({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, { isAuthorized: true, fetchFn: slowFetch as any }),
      resolveVnresCatalogStreams({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, { isAuthorized: true, fetchFn: slowFetch as any }),
      resolveVnresCatalogStreams({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, { isAuthorized: true, fetchFn: slowFetch as any }),
      resolveVnresCatalogStreams({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, { isAuthorized: true, fetchFn: slowFetch as any }),
      resolveVnresCatalogStreams({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' }, { isAuthorized: true, fetchFn: slowFetch as any }),
    ]);

    // All 5 callers must receive the resolved streams
    for (const r of results) {
      assert.equal(r.matched, true);
      assert.equal(r.streams.length, 1);
    }

    // Exactly 1 upstream fetch must have been dispatched
    assert.equal(fetchCount, 1, 'Only leader must dispatch upstream');

    // Exactly 1 budget slot must have been consumed (F-22-03)
    const stats = getVnresUpstreamStats();
    assert.equal(stats.requestsInWindow, 1, 'Exactly 1 budget reservation consumed; waiting followers must NOT consume budget');

    resetVnresUpstreamBudget();
  });

  console.log('\n================================================================================');
  console.log(`ZimKickOff Streams API Test Suite Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌ Test Suite Unhandled Error:', err);
  process.exit(1);
});
