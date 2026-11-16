import 'server-only';
import { validateAndNormalizeHlsUrl } from '@/lib/validation/stream-url';
import { PublicStreamEntry } from '@/lib/api/types';
import {
  acquireGlobalUpstreamBudget,
  triggerGlobalFailureCooldown,
  recordGlobalUpstreamSuccess,
  getGlobalUpstreamStatus,
  resetGlobalUpstreamCoordination,
  getGlobalCoordinationStore,
  withDistributedSingleFlight,
  CoordinationTimeoutError,
} from '@/lib/api/upstream-coordination';

export { CoordinationTimeoutError };

/**
 * ZimKickOff Developer API — Phase 2.17
 * Centralized VNRES Catalog Integration, Shared Caching & Upstream Traffic Protection
 *
 * Upstream Hostname: https://appp.totalsportslive.xyz/fixtures
 * (Note: Must be 'appp.totalsportslive.xyz', not 'app.totalsportslive.xyz')
 */

export const VNRES_CATALOG_ENDPOINT = 'https://appp.totalsportslive.xyz/fixtures';

/**
 * Trusted CDN Hostnames for Direct HLS Stream Delivery.
 * Verified during Phase 2.16 and Phase 2.17 investigations.
 */
export const TRUSTED_HLS_DOMAINS = [
  'pull.niur.live',
  'pull.niues.live',
  'pull06.scstream.net',
  'niur.live',
  'niues.live',
  'scstream.net',
  'broadcast.co.zw',
  'zimkickoff.co.zw',
  'example.com', // For test and staging mock environments
] as const;

export interface VnresRawFixtureItem {
  source?: string;
  room_id?: string | number;
  fixture_original?: string;
  fixture_en?: string;
  fixture_key?: string;
  stream_number?: number;
  health?: string;
  m3u8_hd?: string;
  m3u8_sd?: string;
  flv_hd?: string;
  flv_sd?: string;
  [key: string]: any;
}

export interface VnresCatalogResponse {
  cachedAt?: number;
  total?: number;
  fixtures?: VnresRawFixtureItem[];
}

export interface VnresTargetFixture {
  homeTeam: string;
  awayTeam: string;
  rawTitle?: string;
  numericMatchId?: string;
}

export interface VnresCatalogResolutionResult {
  authorized: boolean;
  matched: boolean;
  streams: PublicStreamEntry[];
  fixtureKey?: string;
  reason?: string;
}

export interface VnresUpstreamBudgetStats {
  requestsInWindow: number;
  budgetCeiling: number;
  inCooldown: boolean;
  cooldownRemainingSeconds: number;
}

export class VnresUpstreamError extends Error {
  statusCode: number;
  retryAfter: number;
  isUpstreamOutage: boolean;

  constructor(message = 'VNRES catalog upstream error', statusCode = 503, retryAfter = 30) {
    super(message);
    this.name = 'VnresUpstreamError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
    this.isUpstreamOutage = true;
  }
}

// -----------------------------------------------------------------------------
// 1. Provider Authorization Gate
// -----------------------------------------------------------------------------

/**
 * Checks whether automated retrieval and redistribution of direct HLS URLs from
 * the VNRES catalog are explicitly authorized.
 *
 * Current legal status:
 * - Public accessibility of the endpoint does NOT constitute authorization.
 * - ZimKickOff terms disclaim stream hosting and attribute all content to third parties.
 * - ZimKickOff possesses no formal license or redistribution agreement with VNRES/TotalSportsLive.
 * - Therefore, this integration MUST remain disabled-by-default in production
 *   until formal provider licensing is executed.
 */
export function isVnresCatalogAuthorized(override?: boolean): boolean {
  if (typeof override === 'boolean') {
    return override;
  }
  return process.env.ENABLE_VNRES_CATALOG === 'true';
}

// -----------------------------------------------------------------------------
// 2. Stream URL Security & Host Allowlist
// -----------------------------------------------------------------------------

/**
 * Strictly verifies whether an HLS manifest URL belongs to an authorized and trusted CDN host.
 * Requires HTTPS, rejects embedded credentials, and rejects unauthorized origins.
 */
export function isTrustedHlsHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (!host) {
      return false;
    }

    return TRUSTED_HLS_DOMAINS.some(
      (trusted) => host === trusted || host.endsWith(`.${trusted}`)
    );
  } catch {
    return false;
  }
}

/**
 * Validates, normalizes, and security-checks a candidate VNRES HLS stream URL.
 * Combines Anti-SSRF validation with trusted CDN domain allowlisting.
 */
export function validateVnresStreamUrl(rawUrl: string): string {
  // 1. Syntactic anti-SSRF validation (blocks private IPs, localhost, metadata, alternative numeric notations)
  const normalized = validateAndNormalizeHlsUrl(rawUrl);

  // 2. Trusted CDN domain verification
  if (!isTrustedHlsHost(normalized)) {
    throw new Error(`Stream URL host is not in the trusted VNRES CDN allowlist: ${normalized}`);
  }

  return normalized;
}

// -----------------------------------------------------------------------------
// 3. Signed URL Token Expiration & Redaction
// -----------------------------------------------------------------------------

const MIN_PLAUSIBLE_EPOCH_SEC = 1_577_836_800; // 2020-01-01T00:00:00Z
const MAX_PLAUSIBLE_EPOCH_SEC = 2_500_000_000; // 2049-03-22T04:26:40Z

/**
 * Extracts the expiration timestamp (in milliseconds since Unix epoch) from a signed HLS URL.
 * Hardened for Phase 2.19 against ambiguous formats and out-of-range projections:
 * - txTime: Tencent Cloud live streaming format (strictly 7-8 char hexadecimal Unix seconds).
 * - auth_key: Aliyun Type A format (strictly timestamp-rand-uid-md5hash with 10-digit decimal epoch seconds).
 * - exp / expires: Standard decimal Unix timestamp in seconds or milliseconds.
 *
 * Rejects unsupported or ambiguous representations, decimal masquerading as hex,
 * and nonsensical distant expiration dates.
 */
export function extractSignedUrlExpiryMs(urlStr: string): number | null {
  try {
    const parsed = new URL(urlStr);

    // 1. txTime (Tencent Cloud live streaming format: hexadecimal Unix epoch seconds, e.g. 6af5d694)
    const txTime = parsed.searchParams.get('txTime');
    if (txTime) {
      const trimmedTx = txTime.trim();
      // Valid Tencent txTime representation must be 7 or 8 hexadecimal characters
      if (/^[0-9a-fA-F]{7,8}$/.test(trimmedTx)) {
        const hexSec = parseInt(trimmedTx, 16);
        if (!isNaN(hexSec) && hexSec >= MIN_PLAUSIBLE_EPOCH_SEC && hexSec <= MAX_PLAUSIBLE_EPOCH_SEC) {
          return hexSec * 1000;
        }
      }
      // Explicitly reject 10-digit decimal epoch seconds mistakenly passed as txTime or out-of-range hex
    }

    // 2. auth_key (Aliyun Type A format: timestamp-rand-uid-md5hash)
    const authKey = parsed.searchParams.get('auth_key');
    if (authKey) {
      const parts = authKey.trim().split('-');
      // Documented Aliyun Type A format strictly consists of 4 hyphen-delimited fields: timestamp-rand-uid-hash
      if (parts.length === 4) {
        const timestampStr = parts[0];
        const hashStr = parts[3];
        if (/^\d{10}$/.test(timestampStr) && /^[0-9a-zA-Z]+$/.test(hashStr)) {
          const sec = parseInt(timestampStr, 10);
          if (!isNaN(sec) && sec >= MIN_PLAUSIBLE_EPOCH_SEC && sec <= MAX_PLAUSIBLE_EPOCH_SEC) {
            return sec * 1000;
          }
        }
      }
    }

    // 3. expires or exp parameter (decimal Unix timestamp in seconds or ms)
    const exp = parsed.searchParams.get('expires') || parsed.searchParams.get('exp');
    if (exp) {
      const trimmedExp = exp.trim();
      if (/^\d+$/.test(trimmedExp)) {
        const num = parseInt(trimmedExp, 10);
        if (!isNaN(num)) {
          if (num >= MIN_PLAUSIBLE_EPOCH_SEC && num <= MAX_PLAUSIBLE_EPOCH_SEC) {
            return num * 1000;
          }
          if (
            num >= MIN_PLAUSIBLE_EPOCH_SEC * 1000 &&
            num <= MAX_PLAUSIBLE_EPOCH_SEC * 1000
          ) {
            return num;
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a signed URL is expired or will expire within the safety window (default 30 seconds).
 * Ensures developers are never served manifests that expire mid-playback.
 */
export function isSignedUrlExpired(
  urlStr: string,
  safetyWindowMs = 30_000,
  nowMs = Date.now()
): boolean {
  const expiryMs = extractSignedUrlExpiryMs(urlStr);
  if (expiryMs === null) {
    // If no expiration token is present, URL has no detected expiration constraint
    return false;
  }
  return nowMs + safetyWindowMs >= expiryMs;
}

/**
 * Redacts sensitive signing secrets and tokens from URLs for safe logging and telemetry.
 */
export function redactSignedUrlTokens(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const sensitiveKeys = ['txSecret', 'auth_key', 'token', 'secret', 'signature', 'sig', 'key'];
    let modified = false;

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        parsed.searchParams.set(key, 'REDACTED');
        modified = true;
      }
    }

    return modified ? parsed.toString() : urlStr;
  } catch {
    return urlStr.replace(/(txSecret|auth_key|token|secret|signature|sig)=[^&]+/gi, '$1=REDACTED');
  }
}

// -----------------------------------------------------------------------------
// 4. Upstream Traffic Protection & Request Budgeting
// -----------------------------------------------------------------------------

const BUDGET_CONFIG = {
  maxRequestsPerMinute: 120, // Global ceiling: at most 120 upstream requests/minute across all callers
  windowMs: 60_000,
  failureCooldownMs: 30_000, // 30-second cooldown on upstream timeout or 5xx
};

let upstreamRequestTimestamps: number[] = [];
let upstreamCooldownUntil = 0;
const inFlightCatalogFetches = new Map<string, Promise<VnresCatalogResponse>>();

/**
 * Retrieves the current upstream budget and cooldown status.
 */
export function getVnresUpstreamStats(): VnresUpstreamBudgetStats {
  const now = Date.now();
  pruneRequestTimestamps(now);

  const inCooldown = now < upstreamCooldownUntil;
  const cooldownRemainingSeconds = inCooldown ? Math.ceil((upstreamCooldownUntil - now) / 1000) : 0;

  return {
    requestsInWindow: upstreamRequestTimestamps.length,
    budgetCeiling: BUDGET_CONFIG.maxRequestsPerMinute,
    inCooldown,
    cooldownRemainingSeconds,
  };
}

/**
 * Resets the upstream budget, cooldown, and single-flight map (primarily for unit tests).
 */
export function resetVnresUpstreamBudget(): void {
  upstreamRequestTimestamps = [];
  upstreamCooldownUntil = 0;
  inFlightCatalogFetches.clear();
  resetGlobalUpstreamCoordination('vnres').catch(() => {});
}

function pruneRequestTimestamps(now: number): void {
  const cutoff = now - BUDGET_CONFIG.windowMs;
  while (upstreamRequestTimestamps.length > 0 && upstreamRequestTimestamps[0] < cutoff) {
    upstreamRequestTimestamps.shift();
  }
}

async function checkUpstreamBudgetAndCooldownAsync(): Promise<void> {
  const budget = await acquireGlobalUpstreamBudget(
    'vnres',
    BUDGET_CONFIG.maxRequestsPerMinute,
    BUDGET_CONFIG.windowMs / 1000
  );

  if (!budget.allowed) {
    if (budget.reason === 'COOLDOWN') {
      upstreamCooldownUntil = Math.max(upstreamCooldownUntil, Date.now() + budget.retryAfter * 1000);
      throw new VnresUpstreamError(
        `VNRES catalog is in failure cooldown. Upstream temporarily paused for ${budget.retryAfter}s.`,
        503,
        Math.max(1, budget.retryAfter)
      );
    }
    throw new VnresUpstreamError(
      `VNRES catalog upstream request budget ceiling (${BUDGET_CONFIG.maxRequestsPerMinute} req/min) exceeded.`,
      503,
      budget.retryAfter || 30
    );
  }

  // Update in-process timestamps for backward-compatible stats
  pruneRequestTimestamps(Date.now());
  upstreamRequestTimestamps.push(Date.now());
}

function triggerFailureCooldown(reason?: string): void {
  upstreamCooldownUntil = Date.now() + BUDGET_CONFIG.failureCooldownMs;
  triggerGlobalFailureCooldown('vnres', BUDGET_CONFIG.failureCooldownMs / 1000, reason).catch(() => {});
}

async function triggerFailureCooldownAsync(reason?: string): Promise<void> {
  upstreamCooldownUntil = Date.now() + BUDGET_CONFIG.failureCooldownMs;
  await triggerGlobalFailureCooldown('vnres', BUDGET_CONFIG.failureCooldownMs / 1000, reason);
}

// -----------------------------------------------------------------------------
// 5. Fixture Matching Engine & Precision Rules
// -----------------------------------------------------------------------------

/**
 * Strips diacritics, non-alphanumeric characters, and common generic club designators (FC, CF, SC).
 * Preserves distinguishing geographical and historical names (e.g., 'United', 'City', 'Rovers').
 */
export function normalizeTeamName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fc|cf|afc|sc|club|cd|ac)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Multi-lingual, spelling variation, and abbreviation mappings for football teams.
 * Accommodates German/Spanish/Italian vs English naming differences.
 */
export const TEAM_NAME_SYNONYMS: Record<string, string> = {
  munchen: 'munich',
  muenchen: 'munich',
  lisboa: 'lisbon',
  sevilla: 'seville',
  roma: 'rome',
  milano: 'milan',
  napoli: 'naples',
  koln: 'cologne',
  koeln: 'cologne',
  utd: 'united',
  st: 'saint',
  spurs: 'tottenham',
  wolves: 'wolverhampton',
};

/**
 * Splits a normalized team name into significant tokens (words with length >= 2).
 */
export function getTeamTokens(name: string): string[] {
  const normalized = normalizeTeamName(name);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => TEAM_NAME_SYNONYMS[t] || t);
}

/**
 * Normalizes text and appends canonical synonyms for reliable cross-language matching.
 */
function normalizeAndExpandText(text: string): string {
  const norm = normalizeTeamName(text);
  const words = norm.split(' ');
  const expanded = words.map((w) => TEAM_NAME_SYNONYMS[w] || w).join(' ');
  return `${norm} ${expanded}`;
}

/**
 * Determines whether candidate text in the catalog matches a team's significant tokens.
 */
function teamTokensMatchText(tokens: string[], text: string): boolean {
  if (tokens.length === 0 || !text) return false;
  const normText = normalizeAndExpandText(text);
  // All significant tokens of the target team must appear in the candidate text
  return tokens.every((token) => {
    const canonicalToken = TEAM_NAME_SYNONYMS[token] || token;
    const regex = new RegExp(`\\b(${token}|${canonicalToken})\\b`, 'i');
    return regex.test(normText);
  });
}

/**
 * Extracts target fixture team names from TotalSportsLive match-buttons HTML or anchor tags.
 */
export function extractFixtureQueryFromButtonsHtml(html: string): VnresTargetFixture | null {
  if (!html || typeof html !== 'string') return null;

  // 1. Look for <h3>Title</h3>
  const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (h3Match) {
    const raw = h3Match[1].replace(/<[^>]*>/g, '').trim();
    const split = splitFixtureTitle(raw);
    if (split) return { ...split, rawTitle: raw };
  }

  // 2. Look for class="match-title"
  const titleClassMatch = html.match(/<div[^>]*class=["'][^"']*match-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (titleClassMatch) {
    const raw = titleClassMatch[1].replace(/<[^>]*>/g, '').trim();
    const split = splitFixtureTitle(raw);
    if (split) return { ...split, rawTitle: raw };
  }

  // 3. Look for fixture parameter in links: ?fixture=Arsenal+vs+Chelsea
  const fixtureParamMatch = html.match(/[?&]fixture=([^&"'>\s]+)/i);
  if (fixtureParamMatch) {
    try {
      const decoded = decodeURIComponent(fixtureParamMatch[1].replace(/\+/g, ' ')).trim();
      const split = splitFixtureTitle(decoded);
      if (split) return { ...split, rawTitle: decoded };
    } catch {
      // Ignore URL decoding errors
    }
  }

  return null;
}

function splitFixtureTitle(title: string): { homeTeam: string; awayTeam: string } | null {
  if (!title) return null;
  const separators = [' vs ', ' v ', ' - ', ' / ', ' VS ', ' V '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        return {
          homeTeam: parts[0].trim(),
          awayTeam: parts[1].trim(),
        };
      }
    }
  }
  return null;
}

/**
 * Derives a canonical, normalized match key from team names for grouping and deduplication.
 */
export function deriveCanonicalMatchKey(home: string, away: string): string {
  const normHome = normalizeTeamName(home).replace(/\s+/g, '_');
  const normAway = normalizeTeamName(away).replace(/\s+/g, '_');
  return `${normHome}_vs_${normAway}`;
}

export interface MatchCatalogOutput {
  matched: boolean;
  fixtureKey?: string;
  matchedItems: VnresRawFixtureItem[];
  reason?: string;
}

/**
 * Matches target fixture teams against items in the VNRES catalog with strict precision:
 * 1. Both Home and Away teams MUST match candidate entries.
 * 2. Rejects single-team partial matches (e.g., target 'Arsenal vs Chelsea' will never match 'Arsenal vs Everton').
 * 3. Ambiguity rejection: If items match multiple distinct fixture keys, rejects all to prevent wrong match delivery.
 */
export function matchCatalogFixtures(
  target: VnresTargetFixture,
  catalogItems: VnresRawFixtureItem[]
): MatchCatalogOutput {
  if (!target || !target.homeTeam || !target.awayTeam) {
    return {
      matched: false,
      matchedItems: [],
      reason: 'Target fixture lacks home or away team specification',
    };
  }

  const homeTokens = getTeamTokens(target.homeTeam);
  const awayTokens = getTeamTokens(target.awayTeam);

  if (homeTokens.length === 0 || awayTokens.length === 0) {
    return {
      matched: false,
      matchedItems: [],
      reason: 'Insufficient team token specificity for reliable matching',
    };
  }

  // Filter items matching BOTH home AND away tokens
  const candidateMatches: { item: VnresRawFixtureItem; key: string }[] = [];

  for (const item of catalogItems || []) {
    // Exclude DEAD health streams
    if (item.health && item.health.toUpperCase() === 'DEAD') {
      continue;
    }

    // Inspect available fixture name fields
    const candidates = [
      item.fixture_en,
      item.fixture_original,
      item.fixture_key,
    ].filter(Boolean) as string[];

    const combinedCandidateText = candidates.join(' ');

    const homeMatches = teamTokensMatchText(homeTokens, combinedCandidateText);
    const awayMatches = teamTokensMatchText(awayTokens, combinedCandidateText);

    if (homeMatches && awayMatches) {
      // Determine canonical key for grouping
      let itemKey = item.fixture_key;
      if (!itemKey) {
        itemKey = deriveCanonicalMatchKey(target.homeTeam, target.awayTeam);
      }
      candidateMatches.push({ item, key: itemKey });
    }
  }

  if (candidateMatches.length === 0) {
    return {
      matched: false,
      matchedItems: [],
      reason: `No catalog fixtures matched ${target.homeTeam} vs ${target.awayTeam}`,
    };
  }

  // Check for ambiguous matches: do candidate items belong to multiple distinct fixture identities?
  const distinctKeys = Array.from(new Set(candidateMatches.map((c) => c.key)));
  if (distinctKeys.length > 1) {
    // Ambiguity detected: do not guess!
    return {
      matched: false,
      matchedItems: [],
      reason: `Ambiguous match: query matched ${distinctKeys.length} distinct fixture keys (${distinctKeys.join(', ')})`,
    };
  }

  return {
    matched: true,
    fixtureKey: distinctKeys[0],
    matchedItems: candidateMatches.map((c) => c.item),
  };
}

// -----------------------------------------------------------------------------
// 6. Direct HLS Stream Formatting
// -----------------------------------------------------------------------------

/**
 * Assembles and validates public HLS stream entries from matched catalog items.
 * Preserves signed tokens, filters expired manifests, and guarantees independent player compatibility.
 */
export function formatVnresPublicStreams(
  matchedItems: VnresRawFixtureItem[],
  safetyWindowMs = 30_000
): PublicStreamEntry[] {
  const streams: PublicStreamEntry[] = [];
  const seenUrls = new Set<string>();
  let count = 1;

  for (const item of matchedItems) {
    // 1. Process HD variant
    if (item.m3u8_hd && typeof item.m3u8_hd === 'string') {
      const rawHd = item.m3u8_hd.trim();
      try {
        const validatedUrl = validateVnresStreamUrl(rawHd);

        if (!isSignedUrlExpired(validatedUrl, safetyWindowMs)) {
          if (!seenUrls.has(validatedUrl)) {
            seenUrls.add(validatedUrl);
            streams.push({
              id: `stream-${count}`,
              name: count === 1 ? 'HD Stream' : `HD Stream ${count}`,
              provider: 'VNRES',
              type: 'hls',
              url: validatedUrl,
            });
            count++;
          }
        }
      } catch {
        // Discard malformed or untrusted URLs safely
      }
    }

    // 2. Process SD variant
    if (item.m3u8_sd && typeof item.m3u8_sd === 'string') {
      const rawSd = item.m3u8_sd.trim();
      try {
        const validatedUrl = validateVnresStreamUrl(rawSd);

        if (!isSignedUrlExpired(validatedUrl, safetyWindowMs)) {
          if (!seenUrls.has(validatedUrl)) {
            seenUrls.add(validatedUrl);
            streams.push({
              id: `stream-${count}`,
              name: 'SD Stream',
              provider: 'VNRES',
              type: 'hls',
              url: validatedUrl,
            });
            count++;
          }
        }
      } catch {
        // Discard malformed or untrusted URLs safely
      }
    }
  }

  return streams;
}

// -----------------------------------------------------------------------------
// 7. Centralized VNRES Catalog Client & Request Deduplication
// -----------------------------------------------------------------------------

export interface VnresCatalogOptions {
  isAuthorized?: boolean;
  fetchFn?: typeof fetch;
}

/**
 * Resolves direct HLS streams from the VNRES catalog.
 *
 * Workflow:
 * 1. Checks the Provider Authorization Gate.
 * 2. If unauthorized, exits immediately with empty streams (safe scaffolding).
 * 3. Enforces upstream budget ceiling, cooldown, and single-flight request coalescing.
 * 4. Queries https://appp.totalsportslive.xyz/fixtures.
 * 5. Matches fixtures using robust normalized token matching.
 * 6. Validates stream security and token expiration.
 */
export async function resolveVnresCatalogStreams(
  target: VnresTargetFixture,
  options?: VnresCatalogOptions
): Promise<VnresCatalogResolutionResult> {
  const authorized = isVnresCatalogAuthorized(options?.isAuthorized);

  // Authorization gate: strictly exit if unauthorized
  if (!authorized) {
    return {
      authorized: false,
      matched: false,
      streams: [],
      reason: 'VNRES catalog integration is not authorized; provider licensing required.',
    };
  }

  // Build upstream query string
  const queryString = target.rawTitle || `${target.homeTeam} vs ${target.awayTeam}`;
  const catalogUrl = `${VNRES_CATALOG_ENDPOINT}?fixture=${encodeURIComponent(queryString)}`;

  const customFetch = options?.fetchFn || globalThis.fetch;

  // Single-flight deduplication across concurrent requests (in-process and cross-worker via distributed lock)
  const inFlightKey = queryString.toLowerCase().trim();
  const lockKey = `vnres_lock_${inFlightKey}`;
  const workerId = `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const l2CacheKey = `vnres_cat_${inFlightKey}`;

  let catalogData: VnresCatalogResponse;
  try {
    catalogData = await withDistributedSingleFlight<VnresCatalogResponse>(
      lockKey,
      workerId,
      async () => {
        // Double-check active failure cooldown state before dispatching HTTP request
        // (Guarantees that a follower reacquiring the lock after leader failure respects cooldown)
        const status = await getGlobalUpstreamStatus('vnres');
        if (status.inCooldown) {
          throw new VnresUpstreamError(
            `VNRES catalog is in failure cooldown. Upstream temporarily paused for ${status.cooldownRemainingSeconds}s.`,
            503,
            Math.max(1, status.cooldownRemainingSeconds)
          );
        }

        // Enforce traffic protection: reserve upstream budget ONLY when actually dispatching upstream (F-22-03)
        // Waiting followers coalesced by single-flight do not consume budget reservations.
        await checkUpstreamBudgetAndCooldownAsync();

        try {
          const res = await customFetch(catalogUrl, {
            signal: AbortSignal.timeout(5000), // 5-second upstream timeout
            headers: {
              'User-Agent': 'ZimKickOff-Streams/1.0',
              'Accept': 'application/json',
            },
          });

          if (res.status >= 500) {
            await triggerFailureCooldownAsync(`HTTP ${res.status}`);
            throw new VnresUpstreamError(`VNRES catalog upstream error (HTTP ${res.status})`, 503, 30);
          }

          if (res.status !== 200) {
            throw new VnresUpstreamError(`VNRES catalog unexpected response (HTTP ${res.status})`, 503, 30);
          }

          const json = (await res.json()) as VnresCatalogResponse;
          await recordGlobalUpstreamSuccess('vnres');
          return json;
        } catch (err: any) {
          if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            await triggerFailureCooldownAsync('Upstream timeout after 5 seconds');
            throw new VnresUpstreamError('VNRES catalog upstream timed out after 5 seconds', 504, 30);
          }
          if (err instanceof VnresUpstreamError) {
            throw err;
          }
          await triggerFailureCooldownAsync(err.message || 'Network failure');
          throw new VnresUpstreamError(`VNRES catalog network failure: ${err.message}`, 503, 30);
        }
      },
      {
        l2CacheKey,
        ttlSeconds: 10,
        waitTimeoutMs: 6500,
        pollIntervalMs: 50,
        onLeaderSuccess: async (data, context) => {
          const store = getGlobalCoordinationStore();
          // Publish cache with leader's fencing token, lock key and owner ID to enforce atomic lease ownership (Phase 2.27)
          const published = await store.setL2Cache(
            l2CacheKey,
            data,
            15,
            60,
            undefined,
            undefined,
            null,
            context.fencingToken,
            context.lockKey,
            context.ownerId
          );
          if (!published) {
            console.warn(
              `[VnresCatalog] Cache publication rejected for ${l2CacheKey}: lease expired or superseded (fencingToken: ${context.fencingToken})`
            );
            throw new CoordinationTimeoutError(
              'Leader lease expired or was superseded before publication could be verified',
              2
            );
          }
        },
      }
    );
  } catch (fetchErr) {
    throw fetchErr;
  }

  const catalogItems = catalogData.fixtures || [];

  // Match fixture
  const matchResult = matchCatalogFixtures(target, catalogItems);

  if (!matchResult.matched) {
    return {
      authorized: true,
      matched: false,
      streams: [],
      reason: matchResult.reason,
    };
  }

  // Format and validate streams
  const streams = formatVnresPublicStreams(matchResult.matchedItems);

  return {
    authorized: true,
    matched: true,
    fixtureKey: matchResult.fixtureKey,
    streams,
  };
}
