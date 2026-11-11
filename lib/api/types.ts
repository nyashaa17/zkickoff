/**
 * ZimKickOff Developer API — Shared Types & Histogram Definitions
 */

export interface ApiSettingsRecord {
  id: string;
  is_api_enabled: boolean;
  default_rate_limit_minute: number;
  default_rate_limit_day: number;
  maintenance_message: string;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  developer_name: string;
  developer_email: string;
  key_prefix: string;
  key_hash: string;
  status: 'active' | 'revoked';
  rate_limit_minute: number;
  rate_limit_day: number;
  created_by?: string | null;
  revoked_by?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type SafeApiKey = Omit<ApiKeyRecord, 'key_hash'>;

export interface RateLimitResult {
  allowed: boolean;
  statusCode: 200 | 429 | 503;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  errorMessage?: string;
  errorCode?: 'RATE_LIMIT_EXCEEDED' | 'RATE_LIMIT_UNAVAILABLE';
}

export interface ApiResponseEnvelope<T> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  meta: {
    timestamp: string;
    cached: boolean;
  };
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    retryAfter?: number;
  };
}

export interface PublicTeam {
  name: string;
  code: string;
  logoUrl?: string;
  logoColor?: string;
}

export interface PublicCompetition {
  id?: string;
  name: string;
  region?: string;
  slug?: string | null;
  logoUrl?: string;
}

export interface PublicMatch {
  id: string;
  slug: string;
  status: 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED';
  minute?: number;
  eps?: string;
  score?: {
    home: number;
    away: number;
  } | null;
  teams: {
    home: PublicTeam;
    away: PublicTeam;
  };
  competition: PublicCompetition;
  kickoffTime: string;
  date: string;
  timestamp?: string;
  venue?: string;
  category?: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA';
}

export interface FixturesQueryParams {
  date?: string;
  competition?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// -------------------------------------------------------------------------
// 18-Bin Logarithmic Histogram Specification
//
// Guaranteed Worst-Case Error (Distribution-Free):
//   For any bounded bin i in [0..16], with width W_i = max - min, the maximum
//   possible discrepancy between the interpolated estimate and the true sample
//   percentile is at most W_i (the full bucket width).
//
// Expected Approximation Error (Uniform Distribution Assumption):
//   If sample latencies are assumed to be uniformly distributed within bin i,
//   piecewise linear interpolation yields an expected error bounded by W_i / 2.
//
// Overflow Handling (Bin 17):
//   Bin 17 covers all observations >= 3000ms (up to infinity). When a target
//   percentile falls within Bin 17, linear interpolation across an infinite
//   range is mathematically undefined; the function returns the lower threshold
//   (3000ms) with the documented semantic that the percentile is >= 3000ms.
// -------------------------------------------------------------------------

export interface LatencyBinDefinition {
  min: number;
  max: number;
}

export const LATENCY_BUCKETS_18: LatencyBinDefinition[] = [
  { min: 0,    max: 10       }, // Bin 0:  0 - 9.99ms   (W = 10ms)
  { min: 10,   max: 15       }, // Bin 1:  10 - 14.99ms (W = 5ms)
  { min: 15,   max: 20       }, // Bin 2:  15 - 19.99ms (W = 5ms)
  { min: 20,   max: 30       }, // Bin 3:  20 - 29.99ms (W = 10ms)
  { min: 30,   max: 40       }, // Bin 4:  30 - 39.99ms (W = 10ms)
  { min: 40,   max: 50       }, // Bin 5:  40 - 49.99ms (W = 10ms)
  { min: 50,   max: 70       }, // Bin 6:  50 - 69.99ms (W = 20ms)
  { min: 70,   max: 100      }, // Bin 7:  70 - 99.99ms (W = 30ms)
  { min: 100,  max: 150      }, // Bin 8:  100 - 149.9ms (W = 50ms)
  { min: 150,  max: 200      }, // Bin 9:  150 - 199.9ms (W = 50ms)
  { min: 200,  max: 300      }, // Bin 10: 200 - 299.9ms (W = 100ms)
  { min: 300,  max: 500      }, // Bin 11: 300 - 499.9ms (W = 200ms)
  { min: 500,  max: 750      }, // Bin 12: 500 - 749.9ms (W = 250ms)
  { min: 750,  max: 1000     }, // Bin 13: 750 - 999.9ms (W = 250ms)
  { min: 1000, max: 1500     }, // Bin 14: 1000 - 1499ms (W = 500ms)
  { min: 1500, max: 2000     }, // Bin 15: 1500 - 1999ms (W = 500ms)
  { min: 2000, max: 3000     }, // Bin 16: 2000 - 2999ms (W = 1000ms)
  { min: 3000, max: Infinity }  // Bin 17: >= 3000ms     (Unbounded Overflow Bin)
];

export function createEmptyHistogram(): number[] {
  return new Array(18).fill(0);
}

/**
 * Returns the bin index (0 to 17) for a given duration in milliseconds.
 * Durations >= 3000ms (including values > 10,000ms) map to the overflow bin (17).
 */
export function getHistogramBinIndex(durationMs: number): number {
  if (durationMs < 10) return 0;
  for (let i = 1; i < LATENCY_BUCKETS_18.length - 1; i++) {
    if (durationMs >= LATENCY_BUCKETS_18[i].min && durationMs < LATENCY_BUCKETS_18[i].max) {
      return i;
    }
  }
  return 17; // Overflow bin (>= 3000ms, unbounded)
}

/**
 * Approximates a percentile (e.g. 0.50 for P50, 0.95 for P95) from an 18-bin histogram
 * using piecewise linear interpolation for bounded bins [0..16].
 * If the target percentile falls within the unbounded overflow bin (17), it safely returns
 * the lower bound (3000ms) to indicate an observation >= 3000ms without inventing arbitrary upper bounds.
 */
export function interpolatePercentile(buckets: number[], percentile: number): number {
  if (!buckets || buckets.length !== 18) return 0;
  const total = buckets.reduce((acc, val) => acc + val, 0);
  if (total === 0) return 0;

  const targetCount = total * percentile;
  let runningCount = 0;

  for (let i = 0; i < LATENCY_BUCKETS_18.length; i++) {
    const prevCount = runningCount;
    runningCount += buckets[i];

    if (runningCount >= targetCount && buckets[i] > 0) {
      const bin = LATENCY_BUCKETS_18[i];
      if (!isFinite(bin.max)) {
        // Target percentile is in the unbounded overflow bin (>= 3000ms)
        return bin.min;
      }
      const countInBin = buckets[i];
      const countBeforeBin = targetCount - prevCount;
      const fraction = countBeforeBin / countInBin;
      const interpolated = bin.min + fraction * (bin.max - bin.min);
      return Math.round(interpolated * 10) / 10;
    }
  }

  return LATENCY_BUCKETS_18[LATENCY_BUCKETS_18.length - 1].min;
}
