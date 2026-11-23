import 'server-only';
import {
  acquireGlobalUpstreamBudget,
  triggerGlobalFailureCooldown,
  recordGlobalUpstreamSuccess,
} from '@/lib/api/upstream-coordination';
import { AllowedPlayerStatGroup, FootballProviderError } from './types';
import {
  assertValidDateYYYYMMDD,
  assertValidNumericId,
  assertValidStatGroup,
  parseAndValidateJsonResponse,
} from './validation';

const KING_BASE_URL = 'https://king.totalsportslive.xyz/api/livescore';
const API_BASE_URL = 'https://api.totalsportslive.xyz/api/livescore';

export const TOTALSPORTSLIVE_BUDGETS = {
  API_BURST: {
    provider: 'totalsportslive_api_burst',
    maxRequests: 6,
    windowSeconds: 1,
  },
  API_SUSTAINED: {
    provider: 'totalsportslive_api_sustained',
    maxRequests: 180,
    windowSeconds: 60,
  },
  KING_SUSTAINED: {
    provider: 'totalsportslive_king',
    maxRequests: 40,
    windowSeconds: 60,
  },
} as const;

const DEFAULT_TIMEOUT_MS = 4500;
const MAX_TIMEOUT_MS = 5000;
const MAX_TRANSIENT_RETRIES = 1;

type UpstreamHost = 'api' | 'king';
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let customFetchImpl: FetchLike | null = null;
let configuredTimeoutMs = DEFAULT_TIMEOUT_MS;

/**
 * Allows unit tests to inject a deterministic mock fetch without contacting live upstream.
 */
export function setFootballProviderFetch(fetchFn: FetchLike | null): void {
  customFetchImpl = fetchFn;
}

export function resetFootballProviderFetch(): void {
  customFetchImpl = null;
  configuredTimeoutMs = DEFAULT_TIMEOUT_MS;
}

export function setFootballProviderTimeoutMs(timeoutMs: number): void {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    configuredTimeoutMs = Math.min(Math.floor(timeoutMs), MAX_TIMEOUT_MS);
  }
}

async function acquireHostBudget(host: UpstreamHost, endpointLabel: string): Promise<void> {
  if (host === 'king') {
    const res = await acquireGlobalUpstreamBudget(
      TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.provider,
      TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.maxRequests,
      TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.windowSeconds
    );
    if (!res.allowed) {
      throw budgetDenialToError(res.reason, res.retryAfter, endpointLabel);
    }
    return;
  }

  // F-32-02 (optimized in Stage 3.2.4):
  // `triggerHostCooldown('api')` sets cooldown on BOTH API_BURST and API_SUSTAINED, and
  // `acquire_upstream_budget_lease` atomically checks cooldown BEFORE inserting any reservation.
  // Calling `acquireGlobalUpstreamBudget` directly enforces both cooldown and rolling-window
  // limits in 2 DB RPCs (down from 6 queries) with zero reservations consumed during cooldown.
  const burst = await acquireGlobalUpstreamBudget(
    TOTALSPORTSLIVE_BUDGETS.API_BURST.provider,
    TOTALSPORTSLIVE_BUDGETS.API_BURST.maxRequests,
    TOTALSPORTSLIVE_BUDGETS.API_BURST.windowSeconds
  );
  if (!burst.allowed) {
    throw budgetDenialToError(burst.reason, burst.retryAfter, endpointLabel);
  }

  const sustained = await acquireGlobalUpstreamBudget(
    TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider,
    TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.maxRequests,
    TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.windowSeconds
  );
  if (!sustained.allowed) {
    throw budgetDenialToError(sustained.reason, sustained.retryAfter, endpointLabel);
  }
}

function budgetDenialToError(
  reason: 'OK' | 'COOLDOWN' | 'BUDGET_EXCEEDED' | 'DATABASE_ERROR',
  retryAfter: number,
  endpointLabel: string
): FootballProviderError {
  if (reason === 'DATABASE_ERROR') {
    return new FootballProviderError(
      'COORDINATION_UNAVAILABLE',
      `Global coordination backend unavailable while acquiring budget for ${endpointLabel}.`,
      { statusCode: 503, retryAfter: Math.max(1, retryAfter || 30), isTransient: true }
    );
  }
  if (reason === 'COOLDOWN') {
    return new FootballProviderError(
      'UPSTREAM_COOLDOWN',
      `Upstream provider is in failure cooldown for ${endpointLabel}.`,
      { statusCode: 503, retryAfter: Math.max(1, retryAfter || 15), isTransient: true }
    );
  }
  return new FootballProviderError(
    'UPSTREAM_BUDGET_EXCEEDED',
    `Global upstream request budget exceeded for ${endpointLabel}.`,
    { statusCode: 429, retryAfter: Math.max(1, retryAfter || 1), isTransient: true }
  );
}

async function triggerHostCooldown(
  host: UpstreamHost,
  cooldownSeconds: number,
  reason: string
): Promise<void> {
  if (host === 'king') {
    await triggerGlobalFailureCooldown(
      TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.provider,
      cooldownSeconds,
      reason
    ).catch(() => {});
    return;
  }

  // F-32-02: Apply cooldown atomically to BOTH API burst and sustained keys
  await Promise.all([
    triggerGlobalFailureCooldown(
      TOTALSPORTSLIVE_BUDGETS.API_BURST.provider,
      cooldownSeconds,
      reason
    ).catch(() => {}),
    triggerGlobalFailureCooldown(
      TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider,
      cooldownSeconds,
      reason
    ).catch(() => {}),
  ]);
}

async function recordHostSuccess(host: UpstreamHost): Promise<void> {
  if (host === 'king') {
    await recordGlobalUpstreamSuccess(TOTALSPORTSLIVE_BUDGETS.KING_SUSTAINED.provider).catch(() => {});
    return;
  }

  await Promise.all([
    recordGlobalUpstreamSuccess(TOTALSPORTSLIVE_BUDGETS.API_BURST.provider).catch(() => {}),
    recordGlobalUpstreamSuccess(TOTALSPORTSLIVE_BUDGETS.API_SUSTAINED.provider).catch(() => {}),
  ]);
}

function isAbortOrTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name || '';
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * Executes a bounded, budget-enforced HTTP GET against an allowlisted TotalSportsLive URL.
 *
 * Retry policy:
 * - At most 1 retry ONLY on transient network or timeout errors.
 * - Re-acquires global upstream budget BEFORE the retry attempt.
 * - Never retries HTTP 4xx, HTTP 502 HTML pages, invalid Content-Type,
 *   malformed JSON, budget denials, cooldowns, or coordination failures.
 */
async function fetchValidatedJson(
  host: UpstreamHost,
  url: string,
  endpointLabel: string
): Promise<Record<string, unknown>> {
  const fetchFn: FetchLike = customFetchImpl ?? ((input, init) => fetch(input, init));

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt++) {
    // 1. Acquire global upstream budget BEFORE every attempt (including retries)
    await acquireHostBudget(host, endpointLabel);

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(configuredTimeoutMs),
      });
    } catch (err: unknown) {
      const timedOut = isAbortOrTimeoutError(err);
      const isLastAttempt = attempt >= MAX_TRANSIENT_RETRIES;

      if (!isLastAttempt) {
        continue;
      }

      throw new FootballProviderError(
        'UPSTREAM_TIMEOUT',
        timedOut
          ? `Upstream request timed out after ${configuredTimeoutMs}ms for ${endpointLabel}.`
          : `Upstream network error for ${endpointLabel}: ${err instanceof Error ? err.message : String(err)}`,
        { statusCode: 504, retryAfter: 10, isTransient: true }
      );
    }

    // 2. Validate HTTP status, Content-Type, non-HTML body, and JSON object root
    try {
      const parsed = await parseAndValidateJsonResponse(response, endpointLabel);
      await recordHostSuccess(host);
      return parsed;
    } catch (err: unknown) {
      if (
        err instanceof FootballProviderError &&
        (response.status === 429 || response.status === 503 || response.status === 504)
      ) {
        const cooldownSeconds =
          response.status === 429 ? Math.max(15, err.retryAfter ?? 30) : 20;
        await triggerHostCooldown(
          host,
          cooldownSeconds,
          `HTTP ${response.status} from ${endpointLabel}`
        );
      }
      // Never retry HTTP errors, HTML 502s, invalid Content-Type, or malformed JSON
      throw err;
    }
  }

  throw new FootballProviderError(
    'UPSTREAM_TIMEOUT',
    `Exhausted upstream attempts for ${endpointLabel}.`,
    { statusCode: 504, retryAfter: 10, isTransient: true }
  );
}

// -----------------------------------------------------------------------------
// Verified Endpoint Clients (14 Approved Endpoints)
// -----------------------------------------------------------------------------

export async function fetchLivescoreByDate(date: string): Promise<Record<string, unknown>> {
  const validDate = assertValidDateYYYYMMDD(date);
  return fetchValidatedJson('king', `${KING_BASE_URL}?date=${validDate}`, `livescore?date=${validDate}`);
}

export async function fetchMatchScoreboard(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/scoreboard`, `match/${id}/scoreboard`);
}

export async function fetchMatchInfo(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/info`, `match/${id}/info`);
}

export async function fetchMatchIncidents(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/incidents`, `match/${id}/incidents`);
}

export async function fetchMatchStatistics(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/statistics`, `match/${id}/statistics`);
}

export async function fetchMatchLineups(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/lineups`, `match/${id}/lineups`);
}

export async function fetchMatchForm(eventId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(eventId, 'eventId');
  return fetchValidatedJson('api', `${API_BASE_URL}/match/${id}/form`, `match/${id}/form`);
}

export async function fetchCompetitionDetails(compId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(compId, 'compId');
  return fetchValidatedJson('api', `${API_BASE_URL}/competition/${id}/details`, `competition/${id}/details`);
}

export async function fetchCompetitionTable(compId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(compId, 'compId');
  return fetchValidatedJson('api', `${API_BASE_URL}/competition/${id}/table`, `competition/${id}/table`);
}

export async function fetchTeamDetails(teamId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(teamId, 'teamId');
  return fetchValidatedJson('api', `${API_BASE_URL}/team/${id}/details`, `team/${id}/details`);
}

export async function fetchTeamSquad(teamId: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(teamId, 'teamId');
  return fetchValidatedJson('api', `${API_BASE_URL}/team/${id}/squad`, `team/${id}/squad`);
}

export async function fetchTeamPlayerStats(
  compId: string,
  teamId: string,
  group: AllowedPlayerStatGroup | string
): Promise<Record<string, unknown>> {
  const validCompId = assertValidNumericId(compId, 'compId');
  const validTeamId = assertValidNumericId(teamId, 'teamId');
  const validGroup = assertValidStatGroup(group);
  return fetchValidatedJson(
    'api',
    `${API_BASE_URL}/competition/${validCompId}/team/${validTeamId}/player-stats/${validGroup}`,
    `competition/${validCompId}/team/${validTeamId}/player-stats/${validGroup}`
  );
}

export async function fetchPlayerProfile(aid: string): Promise<Record<string, unknown>> {
  const id = assertValidNumericId(aid, 'aid');
  return fetchValidatedJson('api', `${API_BASE_URL}/player/${id}`, `player/${id}`);
}

export async function fetchPlayerTeammates(
  teamId: string,
  aid: string
): Promise<Record<string, unknown>> {
  const validTeamId = assertValidNumericId(teamId, 'teamId');
  const validAid = assertValidNumericId(aid, 'aid');
  return fetchValidatedJson(
    'api',
    `${API_BASE_URL}/team/${validTeamId}/player/${validAid}/teammates`,
    `team/${validTeamId}/player/${validAid}/teammates`
  );
}
