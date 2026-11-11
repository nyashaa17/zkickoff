import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { checkDeveloperApiKillSwitch } from '@/lib/api/kill-switch';
import { verifyDeveloperApiKey } from '@/lib/api/auth';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { getOrFetchWithSWR, CACHE_PROFILES } from '@/lib/api/cache';
import { recordApiEvent } from '@/lib/api/analytics';
import { sanitizePublicMatch } from '@/lib/api/match-sanitizer';
import { fetchMatchesForDate, enrichMatchesWithLogos } from '@/lib/server-matches';
import { getFormattedDateString } from '@/lib/totalsports-api';

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let apiKeyIdForAnalytics = '';

  try {
    // 1. Kill switch evaluation
    const killSwitch = await checkDeveloperApiKillSwitch();
    if (!killSwitch.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: killSwitch.errorCode || 'API_DISABLED',
            message: killSwitch.message,
            retryAfter: 30,
          },
        },
        {
          status: 503,
          headers: {
            'Retry-After': '30',
          },
        }
      );
    }

    // 2. Authentication verification
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('x-api-key');
    const authResult = await verifyDeveloperApiKey(authHeader, apiKeyHeader);

    if (!authResult.valid || !authResult.keyRecord) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: authResult.errorCode || 'INVALID_API_KEY',
            message: authResult.errorMessage || 'Authentication failed.',
          },
        },
        { status: 401 }
      );
    }

    const key = authResult.keyRecord;
    apiKeyIdForAnalytics = key.id;

    // 3. Distributed Rate Limiting
    const rateLimit = await enforceRateLimit(key.id, key.rate_limit_minute, key.rate_limit_day);
    if (!rateLimit.allowed) {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rateLimit.reset),
      };
      if (rateLimit.retryAfter) {
        headers['Retry-After'] = String(rateLimit.retryAfter);
      }

      recordApiEvent({
        apiKeyId: key.id,
        endpoint: '/api/v1/matches/live',
        statusCode: rateLimit.statusCode,
        latencyMs: Date.now() - startTime,
        timestamp: startTime,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: rateLimit.errorCode || 'RATE_LIMIT_EXCEEDED',
            message: rateLimit.errorMessage || 'Rate limit exceeded.',
            retryAfter: rateLimit.retryAfter,
          },
        },
        {
          status: rateLimit.statusCode,
          headers,
        }
      );
    }

    // 4. Query parameter processing
    const { searchParams } = new URL(req.url);
    const competitionFilter = searchParams.get('competition')?.toLowerCase().trim();

    // 5. Cache & SWR upstream fetch
    const todayStr = getFormattedDateString(0);
    const cacheKey = `dev-api-live-matches-${todayStr}`;

    const swrResult = await getOrFetchWithSWR(
      cacheKey,
      async () => {
        const rawMatches = await fetchMatchesForDate(todayStr, 'Today', 15);
        return enrichMatchesWithLogos(rawMatches);
      },
      CACHE_PROFILES.LIVE_MATCHES
    );

    // Filter only currently live matches
    const rawLiveMatches = (swrResult.data || []).filter((m) => m.status === 'LIVE');

    // Sanitize matches (STRICT: Strip all streams, HLS, embed URLs, and upstream metadata)
    let sanitizedLiveMatches = rawLiveMatches.map(sanitizePublicMatch);

    // Apply optional competition filter
    if (competitionFilter) {
      sanitizedLiveMatches = sanitizedLiveMatches.filter((m) => {
        const nameMatch = m.competition.name?.toLowerCase().includes(competitionFilter);
        const slugMatch = m.competition.slug?.toLowerCase().includes(competitionFilter);
        const idMatch = m.competition.id?.toLowerCase() === competitionFilter;
        return nameMatch || slugMatch || idMatch;
      });
    }

    const durationMs = Date.now() - startTime;

    // Record non-blocking analytics
    recordApiEvent({
      apiKeyId: key.id,
      endpoint: '/api/v1/matches/live',
      statusCode: 200,
      latencyMs: durationMs,
      timestamp: startTime,
    });

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.reset),
      'X-Cache': swrResult.source,
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
    };
    if (swrResult.retryAfter) {
      responseHeaders['Retry-After'] = String(swrResult.retryAfter);
    }

    return NextResponse.json(
      {
        success: true,
        data: sanitizedLiveMatches,
        meta: {
          timestamp: new Date().toISOString(),
          cached: swrResult.source !== 'MISS',
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    if (apiKeyIdForAnalytics) {
      recordApiEvent({
        apiKeyId: apiKeyIdForAnalytics,
        endpoint: '/api/v1/matches/live',
        statusCode: 500,
        latencyMs: durationMs,
        timestamp: startTime,
      });
    }

    console.error('[Developer API] Live matches error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving live matches.',
        },
      },
      { status: 500 }
    );
  }
}
