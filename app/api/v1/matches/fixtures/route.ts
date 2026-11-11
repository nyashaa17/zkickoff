import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { checkDeveloperApiKillSwitch } from '@/lib/api/kill-switch';
import { verifyDeveloperApiKey } from '@/lib/api/auth';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { getOrFetchWithSWR, CACHE_PROFILES } from '@/lib/api/cache';
import { recordApiEvent } from '@/lib/api/analytics';
import { 
  sanitizePublicMatch, 
  validateAndFormatDateParam, 
  filterAndPaginateMatches 
} from '@/lib/api/match-sanitizer';
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
        endpoint: '/api/v1/matches/fixtures',
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

    // 4. Query parameter parsing & validation
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const competition = searchParams.get('competition') || undefined;
    const status = searchParams.get('status') || undefined;
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const dateValidation = validateAndFormatDateParam(dateParam);
    if (!dateValidation.valid || !dateValidation.dateStr || !dateValidation.dateLabel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QUERY_PARAMETER',
            message: dateValidation.errorMessage || 'Invalid date parameter.',
          },
        },
        { status: 400 }
      );
    }

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QUERY_PARAMETER',
            message: 'Parameter "page" must be a positive integer >= 1.',
          },
        },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_QUERY_PARAMETER',
            message: 'Parameter "limit" must be an integer between 1 and 100.',
          },
        },
        { status: 400 }
      );
    }

    // 5. Cache profile selection
    const isToday = dateValidation.dateStr === getFormattedDateString(0);
    const cacheProfile = isToday
      ? CACHE_PROFILES.TODAY_FIXTURES
      : CACHE_PROFILES.FUTURE_FIXTURES;
    const cacheKey = `dev-api-fixtures-${dateValidation.dateStr}`;

    const swrResult = await getOrFetchWithSWR(
      cacheKey,
      async () => {
        const revalidateSec = isToday ? 60 : 1800;
        const rawMatches = await fetchMatchesForDate(
          dateValidation.dateStr!,
          dateValidation.dateLabel!,
          revalidateSec
        );
        return enrichMatchesWithLogos(rawMatches);
      },
      cacheProfile
    );

    // Sanitize matches (excises streams, embed URLs, and upstream provider credentials)
    const sanitizedMatches = (swrResult.data || []).map(sanitizePublicMatch);

    // Filter by competition, status and paginate
    const filteredResult = filterAndPaginateMatches(sanitizedMatches, {
      competition,
      status,
      page,
      limit,
    });

    const durationMs = Date.now() - startTime;

    // Record non-blocking analytics
    recordApiEvent({
      apiKeyId: key.id,
      endpoint: '/api/v1/matches/fixtures',
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
      'Cache-Control': isToday
        ? 'public, s-maxage=60, stale-while-revalidate=300'
        : 'public, s-maxage=1800, stale-while-revalidate=7200',
    };
    if (swrResult.retryAfter) {
      responseHeaders['Retry-After'] = String(swrResult.retryAfter);
    }

    return NextResponse.json(
      {
        success: true,
        data: filteredResult.data,
        pagination: filteredResult.pagination,
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
        endpoint: '/api/v1/matches/fixtures',
        statusCode: 500,
        latencyMs: durationMs,
        timestamp: startTime,
      });
    }

    console.error('[Developer API] Fixtures error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving fixtures.',
        },
      },
      { status: 500 }
    );
  }
}
