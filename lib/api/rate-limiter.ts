import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { RateLimitResult } from './types';

interface LocalLeaseBucket {
  tokens: number;       // Unconsumed remaining tokens in this local lease
  consumed: number;     // Number of tokens actually consumed by HTTP requests from this lease
  leaseId: string | null;
  minuteWindow: number;
  dayWindow: number;
  minuteLimit: number;
  dayLimit: number;
  minuteRemaining: number;
  dayRemaining: number;
}

interface PendingReconciliation {
  leaseId: string;
  unusedTokens: number;
  consumedTokens: number;
}

// In-memory per-worker lease store: Map<keyId, LocalLeaseBucket>
const localLeases = new Map<string, LocalLeaseBucket>();
// Map of pending lease reconciliations to report on the next lease request: Map<keyId, PendingReconciliation>
const pendingReconciliations = new Map<string, PendingReconciliation>();

const WORKER_COUNT = 2;
const MAX_ADAPTIVE_LEASE = 5;

/**
 * Computes current UTC epoch-minute timestamp in seconds.
 */
export function getCurrentMinuteWindow(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / 60000) * 60;
}

/**
 * Computes current UTC epoch-day timestamp in seconds.
 */
export function getCurrentDayWindow(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / 86400000) * 86400;
}

/**
 * Calculates adaptive lease size according to the approved formula:
 * lease_size = min(5, max(1, floor(minute_remaining / num_workers)))
 */
export function calculateAdaptiveLeaseSize(minuteRemaining: number, numWorkers: number = WORKER_COUNT): number {
  if (minuteRemaining <= 0) return 1;
  const proportional = Math.floor(minuteRemaining / numWorkers);
  return Math.min(MAX_ADAPTIVE_LEASE, Math.max(1, proportional));
}

/**
 * Enforces distributed rate limiting using the PostgreSQL Quota Lease Model.
 */
export async function enforceRateLimit(
  keyId: string,
  minuteLimit: number,
  dayLimit: number
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const currentMinute = getCurrentMinuteWindow(nowMs);
  const currentDay = getCurrentDayWindow(nowMs);
  const nowSec = Math.floor(nowMs / 1000);
  const resetSec = currentMinute + 60;

  let bucket = localLeases.get(keyId);

  // Check if bucket minute window has expired (epoch-minute rollover)
  if (bucket && bucket.minuteWindow !== currentMinute) {
    if (bucket.leaseId) {
      // Invalidate minute tokens and queue lease reconciliation:
      // - bucket.tokens represents genuinely unconsumed tokens to return to daily balance
      // - bucket.consumed represents tokens actually consumed by requests
      const existing = pendingReconciliations.get(keyId);
      if (!existing) {
        pendingReconciliations.set(keyId, {
          leaseId: bucket.leaseId,
          unusedTokens: bucket.tokens,
          consumedTokens: bucket.consumed,
        });
      }
    }
    bucket.tokens = 0;
    bucket.consumed = 0;
    bucket.leaseId = null;
    bucket.minuteWindow = currentMinute;
    bucket.minuteRemaining = minuteLimit;
  }

  // Fast path: local lease has available unconsumed tokens
  if (bucket && bucket.tokens > 0 && bucket.minuteWindow === currentMinute) {
    bucket.tokens -= 1;
    bucket.consumed += 1;
    bucket.minuteRemaining = Math.max(0, bucket.minuteRemaining - 1);
    bucket.dayRemaining = Math.max(0, bucket.dayRemaining - 1);

    return {
      allowed: true,
      statusCode: 200,
      limit: minuteLimit,
      remaining: bucket.minuteRemaining,
      reset: resetSec,
    };
  }

  // Slow path: local tokens depleted or uninitialized -> acquire atomic lease from database
  const pending = pendingReconciliations.get(keyId);
  const refundLeaseId = pending ? pending.leaseId : null;
  const refundTokens = pending ? pending.unusedTokens : 0;
  const consumedTokens = pending ? pending.consumedTokens : 0;
  const knownRemaining = bucket ? bucket.minuteRemaining : minuteLimit;
  const requestedLease = calculateAdaptiveLeaseSize(knownRemaining, WORKER_COUNT);

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc('acquire_rate_limit_lease', {
      p_key_id: keyId,
      p_minute_window: currentMinute,
      p_day_window: currentDay,
      p_minute_limit: minuteLimit,
      p_day_limit: dayLimit,
      p_lease_size: requestedLease,
      p_refund_lease_id: refundLeaseId,
      p_refund_tokens: refundTokens,
      p_tokens_consumed: consumedTokens,
    });

    if (error) {
      throw error;
    }

    // Clear pending reconciliation upon successful RPC delivery
    if (refundLeaseId) {
      pendingReconciliations.delete(keyId);
    }

    // Expected return: row of { allowed, granted_lease_id, granted_tokens, minute_remaining, day_remaining }
    const resultRow = Array.isArray(data) ? data[0] : data;
    if (!resultRow) {
      throw new Error('acquire_rate_limit_lease returned empty result');
    }

    const { allowed, granted_lease_id, granted_tokens, minute_remaining, day_remaining } = resultRow;

    if (!allowed || granted_tokens <= 0) {
      // Quota exceeded in minute or day window
      const isDailyExhaustion = day_remaining <= 0;
      const retryAfter = isDailyExhaustion
        ? Math.max(1, currentDay + 86400 - nowSec)
        : Math.max(1, resetSec - nowSec);

      const message = isDailyExhaustion
        ? `Daily rate limit of ${dayLimit} requests exceeded. Window resets in ${retryAfter} seconds.`
        : `Rate limit of ${minuteLimit} requests per minute exceeded. Window resets in ${retryAfter} seconds.`;

      return {
        allowed: false,
        statusCode: 429,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        limit: minuteLimit,
        remaining: 0,
        reset: resetSec,
        retryAfter,
        errorMessage: message,
      };
    }

    // Lease successfully granted: consume 1 token for the current request
    const tokensForWorker = granted_tokens - 1;
    localLeases.set(keyId, {
      tokens: tokensForWorker,
      consumed: 1, // 1 token consumed immediately by this request
      leaseId: granted_lease_id || null,
      minuteWindow: currentMinute,
      dayWindow: currentDay,
      minuteLimit,
      dayLimit,
      minuteRemaining: minute_remaining,
      dayRemaining: day_remaining,
    });

    return {
      allowed: true,
      statusCode: 200,
      limit: minuteLimit,
      remaining: minute_remaining,
      reset: resetSec,
    };
  } catch (err) {
    console.error('[RateLimiter] Database lease acquisition failed:', err);

    // Fail closed: return HTTP 503 Service Unavailable (NEVER claim 429 when DB is down)
    return {
      allowed: false,
      statusCode: 503,
      errorCode: 'RATE_LIMIT_UNAVAILABLE',
      limit: minuteLimit,
      remaining: 0,
      reset: resetSec,
      retryAfter: 30,
      errorMessage: 'Rate limit service temporarily unavailable. Please retry shortly.',
    };
  }
}

/**
 * Resets local in-memory rate limit state (used in testing and maintenance).
 */
export function resetRateLimiterState(): void {
  localLeases.clear();
  pendingReconciliations.clear();
}
