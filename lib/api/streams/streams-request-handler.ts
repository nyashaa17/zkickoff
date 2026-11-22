import { NextRequest, NextResponse } from 'next/server';
import { checkDeveloperApiKillSwitch } from '@/lib/api/kill-switch';
import { verifyDeveloperApiKey } from '@/lib/api/auth';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { recordApiEvent } from '@/lib/api/analytics';
import {
  resolveMatchStreams,
  validateMatchIdentifier,
  MatchNotFoundError,
  UpstreamProviderError,
  CoordinationTimeoutError,
} from '@/lib/api/streams-service';

export interface StreamsRouteDeps {
  checkKillSwitch?: typeof checkDeveloperApiKillSwitch;
  verifyApiKey?: typeof verifyDeveloperApiKey;
  enforceLimit?: typeof enforceRateLimit;
  resolveStreams?: typeof resolveMatchStreams;
}

/**
 * Core handler for GET /api/v1/matches/{matchId}/streams.
 * Supports dependency injection for isolated testing.
 */
export async function handleStreamsRequest(
  req: NextRequest,
  params: Promise<{ matchId: string }>,
  deps?: StreamsRouteDeps
) {
  const startTime = Date.now();
  let apiKeyIdForAnalytics = '';

  const checkKillSwitch = deps?.checkKillSwitch || checkDeveloperApiKillSwitch;
  const verifyApiKey = deps?.verifyApiKey || verifyDeveloperApiKey;
  const enforceLimit = deps?.enforceLimit || enforceRateLimit;
  const resolveStreams = deps?.resolveStreams || resolveMatchStreams;

  try {
    // 1. Kill switch evaluation
    const killSwitch = await checkKillSwitch();
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
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 2. Authentication verification
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('x-api-key');
    const authResult = await verifyApiKey(authHeader, apiKeyHeader);

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

    // 3. Distributed Rate Limiting (enforces established 60/min and 10,000/day limits)
    const rateLimit = await enforceLimit(key.id, key.rate_limit_minute, key.rate_limit_day);
    if (!rateLimit.allowed) {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(rateLimit.reset),
      };
      if (rateLimit.retryAfter) {
        headers['Retry-After'] = String(rateLimit.retryAfter);
      }

      try {
        recordApiEvent({
          apiKeyId: key.id,
          endpoint: '/api/v1/matches/:matchId/streams',
          statusCode: rateLimit.statusCode,
          latencyMs: Date.now() - startTime,
          timestamp: startTime,
        });
      } catch {
        // Failure isolation: telemetry failure never breaks API execution
      }

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

    // 4. Validate and resolve match identifier
    const { matchId } = await params;
    const validation = validateMatchIdentifier(matchId);
    if (!validation.valid) {
      try {
        recordApiEvent({
          apiKeyId: key.id,
          endpoint: '/api/v1/matches/:matchId/streams',
          statusCode: 400,
          latencyMs: Date.now() - startTime,
          timestamp: startTime,
        });
      } catch {
        // Failure isolation
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_MATCH_ID',
            message:
              validation.errorMessage ||
              'Invalid match identifier. Expected numeric match ID, valid ZimKickOff slug, or event UUID.',
          },
        },
        { status: 400 }
      );
    }

    // 5. Retrieve and sanitize stream data via streams service
    let resolution;
    try {
      resolution = await resolveStreams(matchId);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;

      if (err instanceof MatchNotFoundError || err.name === 'MatchNotFoundError') {
        try {
          recordApiEvent({
            apiKeyId: key.id,
            endpoint: '/api/v1/matches/:matchId/streams',
            statusCode: 404,
            latencyMs: durationMs,
            timestamp: startTime,
          });
        } catch {}

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MATCH_NOT_FOUND',
              message: 'The requested match or broadcast event could not be found.',
            },
          },
          { status: 404 }
        );
      }

      if (
        err instanceof CoordinationTimeoutError ||
        err.code === 'ANOTHER_WORKER_FETCHING' ||
        err.name === 'CoordinationTimeoutError' ||
        err.isCoordinationError
      ) {
        const retrySec = err.retryAfter || 2;
        try {
          recordApiEvent({
            apiKeyId: key.id,
            endpoint: '/api/v1/matches/:matchId/streams',
            statusCode: 503,
            latencyMs: durationMs,
            timestamp: startTime,
          });
        } catch {}

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ANOTHER_WORKER_FETCHING',
              message:
                err.message ||
                'Another worker is currently fetching upstream; request timed out waiting for coordination',
              retryAfter: retrySec,
            },
          },
          {
            status: 503,
            headers: {
              'Retry-After': String(retrySec),
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      if (
        err instanceof UpstreamProviderError ||
        err.isUpstreamOutage ||
        err.name === 'UpstreamProviderError'
      ) {
        const retrySec = err.retryAfter || 30;
        try {
          recordApiEvent({
            apiKeyId: key.id,
            endpoint: '/api/v1/matches/:matchId/streams',
            statusCode: 503,
            latencyMs: durationMs,
            timestamp: startTime,
          });
        } catch {}

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'Upstream streams provider is temporarily unavailable. Please retry shortly.',
              retryAfter: retrySec,
            },
          },
          {
            status: 503,
            headers: {
              'Retry-After': String(retrySec),
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      // Re-throw unexpected errors to outer catch block
      throw err;
    }

    const durationMs = Date.now() - startTime;

    // 6. Record non-blocking telemetry (aggregation deferred; isolated from response)
    try {
      recordApiEvent({
        apiKeyId: key.id,
        endpoint: '/api/v1/matches/:matchId/streams',
        statusCode: 200,
        latencyMs: durationMs,
        timestamp: startTime,
      });
    } catch {
      // Telemetry failure isolation
    }

    // 7. Return standard API response envelope
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.reset),
      'X-Cache': resolution.source,
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
    };
    if (resolution.retryAfter) {
      responseHeaders['Retry-After'] = String(resolution.retryAfter);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          matchId: resolution.data.matchId,
          hasStreams: resolution.data.hasStreams,
          streams: resolution.data.streams,
        },
        meta: {
          timestamp: new Date().toISOString(),
          cached: resolution.source !== 'MISS',
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
      try {
        recordApiEvent({
          apiKeyId: apiKeyIdForAnalytics,
          endpoint: '/api/v1/matches/:matchId/streams',
          statusCode: 500,
          latencyMs: durationMs,
          timestamp: startTime,
        });
      } catch {}
    }

    console.error('[Developer API] Streams route unexpected error:', err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving match streams.',
        },
      },
      { status: 500 }
    );
  }
}
