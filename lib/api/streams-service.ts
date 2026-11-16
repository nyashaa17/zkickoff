import 'server-only';
import { getOrFetchWithSWR, invalidateCacheKey, CACHE_PROFILES, SWRResult } from '@/lib/api/cache';
import { PublicStreamEntry, MatchStreamsData } from '@/lib/api/types';
import { validateAndNormalizeHlsUrl } from '@/lib/validation/stream-url';
import { parseSlug } from '@/lib/server-matches';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  resolveVnresCatalogStreams,
  extractFixtureQueryFromButtonsHtml,
  isSignedUrlExpired,
  VnresTargetFixture,
  VnresUpstreamError,
  CoordinationTimeoutError,
} from '@/lib/api/vnres-catalog';

export { CoordinationTimeoutError };

export class MatchNotFoundError extends Error {
  constructor(message = 'Match or broadcast event not found') {
    super(message);
    this.name = 'MatchNotFoundError';
  }
}

export class UpstreamProviderError extends Error {
  statusCode: number;
  retryAfter?: number;
  isUpstreamOutage: boolean;

  constructor(message = 'Upstream streams provider is unavailable', statusCode = 503, retryAfter = 30) {
    super(message);
    this.name = 'UpstreamProviderError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
    this.isUpstreamOutage = true;
  }
}

export interface InternalStreamFetchResult {
  notFound: boolean;
  matchId: string;
  streams: PublicStreamEntry[];
}

export interface StreamResolutionOutput {
  data: MatchStreamsData;
  source: 'HIT' | 'MISS' | 'STALE';
  retryAfter?: number;
}

export interface StreamServiceDeps {
  fetchFn?: typeof fetch;
  supabaseClient?: any;
  catalogAuthorized?: boolean;
  catalogFetchFn?: typeof fetch;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_REGEX = /^\d+$/;
const SLUG_SYNTAX_REGEX = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/;

export type MatchIdentifierType = 'numeric' | 'uuid' | 'match_slug' | 'event_slug' | 'invalid';

export interface ValidatedIdentifier {
  valid: boolean;
  type: MatchIdentifierType;
  raw: string;
  extractedNumericId?: string;
  errorCode?: 'INVALID_MATCH_ID';
  errorMessage?: string;
}

/**
 * Validates the syntax of an incoming match identifier.
 * Accepts:
 * - Pure numeric ID (e.g. "1738342")
 * - Standalone Event UUID (e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 * - Football match slug (e.g. "highlanders-vs-dynamos-1738342")
 * - Standalone event slug (e.g. "zifa-presidential-cup-final-2026")
 */
export function validateMatchIdentifier(rawInput: string | null | undefined): ValidatedIdentifier {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      valid: false,
      type: 'invalid',
      raw: '',
      errorCode: 'INVALID_MATCH_ID',
      errorMessage: 'Match identifier is required.',
    };
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return {
      valid: false,
      type: 'invalid',
      raw: trimmed,
      errorCode: 'INVALID_MATCH_ID',
      errorMessage: 'Match identifier length must be between 1 and 100 characters.',
    };
  }

  // Pure numeric ID
  if (NUMERIC_REGEX.test(trimmed)) {
    return {
      valid: true,
      type: 'numeric',
      raw: trimmed,
      extractedNumericId: trimmed,
    };
  }

  // Standalone Event UUID
  if (UUID_REGEX.test(trimmed)) {
    return {
      valid: true,
      type: 'uuid',
      raw: trimmed,
    };
  }

  // Verify slug character syntax (alphanumeric separated by single hyphens)
  if (!SLUG_SYNTAX_REGEX.test(trimmed)) {
    return {
      valid: false,
      type: 'invalid',
      raw: trimmed,
      errorCode: 'INVALID_MATCH_ID',
      errorMessage: 'Match identifier contains invalid characters or malformed hyphenation.',
    };
  }

  // Check if it represents a football match slug with trailing numeric ID
  const parsed = parseSlug(trimmed);
  if (parsed.isParseable && parsed.id && parsed.id !== '0' && NUMERIC_REGEX.test(parsed.id)) {
    return {
      valid: true,
      type: 'match_slug',
      raw: trimmed,
      extractedNumericId: parsed.id,
    };
  }

  // Standard slug format (could match a standalone event slug)
  return {
    valid: true,
    type: 'event_slug',
    raw: trimmed,
  };
}

/**
 * Parses and sanitizes upstream TotalSportsLive buttons HTML.
 * Strips script tags, unsafe schemes, and social share links.
 * Extracts genuine, playable HLS (.m3u8) manifest URLs.
 * Never constructs or returns Vicecap embed URLs or player iframes as HLS streams.
 */
export function parseTotalSportsButtonsHtml(html: string, matchId: string): PublicStreamEntry[] {
  const streams: PublicStreamEntry[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let count = 1;

  while ((match = linkRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const rawHref = match[1];
    const rawLabel = match[2];

    // Reject dangerous schemes immediately
    if (/^(javascript|data|vbscript|file):/i.test(rawHref.trim())) {
      continue;
    }

    // Exclude social sharing and messaging links
    const lowerHref = rawHref.toLowerCase();
    if (
      lowerHref.includes('facebook.com') ||
      lowerHref.includes('twitter.com') ||
      lowerHref.includes('x.com') ||
      lowerHref.includes('whatsapp.com') ||
      lowerHref.includes('telegram.org') ||
      lowerHref.includes('t.me')
    ) {
      continue;
    }

    // Vicecap embed URLs must NEVER be misrepresented as HLS
    if (lowerHref.includes('vicecap.github.io')) {
      continue;
    }

    // Check if the link or its query parameters contain an actual .m3u8 manifest URL
    let candidateUrl: string | null = null;
    if (lowerHref.includes('.m3u8')) {
      candidateUrl = rawHref.trim();
    } else {
      try {
        const parsedUrl = new URL(rawHref, 'https://app.totalsportslive.xyz');
        for (const param of ['src', 'url', 'manifest', 'hls', 'm3u8']) {
          const val = parsedUrl.searchParams.get(param);
          if (val && val.toLowerCase().includes('.m3u8')) {
            candidateUrl = val.trim();
            break;
          }
        }
      } catch {
        // Invalid URL syntax
      }
    }

    // Also check data-stream-url or data-m3u8 attributes on the anchor tag
    if (!candidateUrl) {
      const dataAttrMatch = fullTag.match(/data-(?:stream-url|m3u8|hls)=["']([^"']+)["']/i);
      if (dataAttrMatch && dataAttrMatch[1].toLowerCase().includes('.m3u8')) {
        candidateUrl = dataAttrMatch[1].trim();
      }
    }

    // If no genuine .m3u8 URL was located, this is only a player button / web reference.
    // Per Phase 2.15: ZimKickOff must NOT return player embeds as HLS URLs.
    if (!candidateUrl) {
      continue;
    }

    // Reject Vicecap embeds even if passed via query params or data attributes
    if (candidateUrl.toLowerCase().includes('vicecap.github.io')) {
      continue;
    }

    // Strictly validate the candidate HLS URL with Anti-SSRF (rejects private IPs, loopback, metadata)
    let validatedUrl: string;
    try {
      validatedUrl = validateAndNormalizeHlsUrl(candidateUrl);
    } catch {
      // Unsafe or malformed URL rejected
      continue;
    }

    // Sanitize display label
    let label = rawLabel.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!label) {
      label = `Stream Feed ${count}`;
    }

    // Optional provider extraction from data-provider attribute
    const providerAttrMatch = fullTag.match(/data-provider=["']([^"']+)["']/i);
    const provider = providerAttrMatch ? providerAttrMatch[1].trim() : 'TotalSportsLive';

    streams.push({
      id: `stream-${count}`,
      name: label,
      provider,
      type: 'hls',
      url: validatedUrl,
    });

    count++;
  }

  return streams;
}

/**
 * Resolves match broadcast streams from TotalSportsLive upstream or Standalone ZimKickOff Events.
 * Enforces SWR caching, URL sanitization, Anti-SSRF, and strict unpublished event withholding.
 */
export async function resolveMatchStreams(
  rawIdentifier: string,
  deps?: StreamServiceDeps
): Promise<StreamResolutionOutput> {
  const validation = validateMatchIdentifier(rawIdentifier);
  if (!validation.valid) {
    const error = new Error(validation.errorMessage || 'Invalid match identifier.');
    (error as any).code = 'INVALID_MATCH_ID';
    (error as any).statusCode = 400;
    throw error;
  }

  const customFetch = deps?.fetchFn || globalThis.fetch;

  // ---------------------------------------------------------------------------
  // Step 1: Check Standalone ZimKickOff Events
  // ---------------------------------------------------------------------------
  // If the identifier is a UUID or slug, inspect the database events table.
  if (validation.type === 'uuid' || validation.type === 'event_slug') {
    const adminClient = deps?.supabaseClient || createAdminClient();
    let eventQuery = adminClient
      .from('events')
      .select('id, title, slug, publication_status, broadcast_status');

    if (validation.type === 'uuid') {
      eventQuery = eventQuery.eq('id', validation.raw);
    } else {
      eventQuery = eventQuery.eq('slug', validation.raw);
    }

    const { data: eventData, error: eventErr } = await eventQuery.maybeSingle();

    if (eventErr) {
      console.warn('[StreamsService] Error checking standalone events:', eventErr.message);
    }

    if (eventData) {
      // CRITICAL: If recognized as a standalone event but publication_status is draft or archived,
      // strictly return 404 MATCH_NOT_FOUND. Never fall through to TotalSportsLive.
      if (eventData.publication_status !== 'published') {
        throw new MatchNotFoundError(`Broadcast event ${validation.raw} is not published`);
      }

      // Published standalone event resolution via SWR cache
      const cacheKey = `dev-api-streams-event-${eventData.id}`;

      const swrResult: SWRResult<InternalStreamFetchResult> = await getOrFetchWithSWR(
        cacheKey,
        async () => {
          // Return no streams for upcoming or concluded events
          if (eventData.broadcast_status !== 'live') {
            return {
              notFound: false,
              matchId: eventData.id,
              streams: [],
            };
          }

          // Broadcast is live: retrieve event_sources in display order
          const { data: sources, error: sourcesErr } = await adminClient
            .from('event_sources')
            .select('id, name, stream_type, stream_url, is_primary, display_order')
            .eq('event_id', eventData.id)
            .order('display_order', { ascending: true });

          if (sourcesErr) {
            throw new Error(`Failed to load event sources: ${sourcesErr.message}`);
          }

          const validStreams: PublicStreamEntry[] = [];

          for (const source of sources || []) {
            // Exclude YouTube and non-HLS streams from direct HLS delivery
            if (source.stream_type !== 'hls') {
              continue;
            }

            try {
              // Direct HLS stream delivery: validate original HLS URL with anti-SSRF protection
              const validatedUrl = validateAndNormalizeHlsUrl(source.stream_url);

              validStreams.push({
                id: source.id,
                name: source.name,
                provider: 'ZimKickOff',
                type: 'hls',
                url: validatedUrl,
              });
            } catch (valErr: any) {
              console.warn(`[StreamsService] Rejected unsafe source (${source.id}): ${valErr?.message}`);
              // Safely exclude invalid or dangerous streams
            }
          }

          return {
            notFound: false,
            matchId: eventData.id,
            streams: validStreams,
          };
        },
        CACHE_PROFILES.STREAMS
      );

      return {
        data: {
          matchId: swrResult.data.matchId,
          hasStreams: swrResult.data.streams.length > 0,
          streams: swrResult.data.streams,
        },
        source: swrResult.source,
        retryAfter: swrResult.retryAfter,
      };
    }

    // Event was not found in database:
    // If it was a UUID, it cannot be a TotalSportsLive match ID -> 404 MATCH_NOT_FOUND
    if (validation.type === 'uuid') {
      throw new MatchNotFoundError(`Event with UUID ${validation.raw} not found`);
    }

    // If it was a slug, check if it matches a football fixture slug with trailing ID
    const parsed = parseSlug(validation.raw);
    if (!parsed.isParseable || !parsed.id || parsed.id === '0' || !NUMERIC_REGEX.test(parsed.id)) {
      // Neither a standalone event nor a football match slug -> 404 MATCH_NOT_FOUND
      throw new MatchNotFoundError(`Match slug ${validation.raw} not found`);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: TotalSportsLive Match Resolution
  // ---------------------------------------------------------------------------
  const numericMatchId = validation.extractedNumericId || (
    validation.type === 'match_slug' ? parseSlug(validation.raw).id : validation.raw
  );

  if (!numericMatchId || !NUMERIC_REGEX.test(numericMatchId)) {
    throw new MatchNotFoundError(`Invalid numeric match identifier for ${validation.raw}`);
  }

  const cacheKey = `dev-api-streams-tsl-${numericMatchId}`;

  const fetchStreamsLive = async (): Promise<InternalStreamFetchResult> => {
    const upstreamUrl = `https://app.totalsportslive.xyz/match-buttons/${encodeURIComponent(numericMatchId)}`;
      let res: Response;

      try {
        res = await customFetch(upstreamUrl, {
          signal: AbortSignal.timeout(5000), // 5-second upstream timeout
          headers: {
            'User-Agent': 'ZimKickOff-Streams/1.0',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
          throw new UpstreamProviderError('TotalSportsLive upstream timed out after 5 seconds', 504, 30);
        }
        throw new UpstreamProviderError(`TotalSportsLive network failure: ${fetchErr.message}`, 503, 30);
      }

      // Check for upstream HTTP 404
      if (res.status === 404) {
        const availabilityHeader = res.headers.get('x-match-availability')?.toLowerCase();
        const html = await res.text();
        const isGenuineNotFound =
          availabilityHeader === 'not-found' ||
          html.includes('"reason":"not-found"') ||
          /data-match-state=["'][^"']*["']reason["']\s*:\s*["']not-found["']/i.test(html);

        if (isGenuineNotFound) {
          return {
            notFound: true,
            matchId: numericMatchId,
            streams: [],
          };
        }

        // Ambiguous 404 without genuine not-found marker indicates upstream degradation
        throw new UpstreamProviderError('TotalSportsLive returned ambiguous 404 status', 503, 30);
      }

      if (res.status >= 500) {
        throw new UpstreamProviderError(`TotalSportsLive upstream server error (HTTP ${res.status})`, 503, 30);
      }

      if (res.status !== 200) {
        throw new UpstreamProviderError(`TotalSportsLive unexpected response (HTTP ${res.status})`, 503, 30);
      }

      const html = await res.text();

      // Check for malformed HTML structure (must contain expected buttons marker or match state)
      const hasMatchStateMarker =
        html.includes('data-match-buttons') ||
        html.includes('data-match-state') ||
        html.includes('match-buttons-client.js') ||
        html.includes('class="match-');

      if (!hasMatchStateMarker) {
        throw new UpstreamProviderError('TotalSportsLive returned malformed HTML without match markers', 503, 30);
      }

      // Check if data-match-state indicates match is scheduled or finished
      const stateMatch = html.match(/data-match-state=["']([^"']+)["']/i);
      if (stateMatch) {
        try {
          const decoded = stateMatch[1]
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
          const parsedState = JSON.parse(decoded);
          if (parsedState.available === false) {
            return {
              notFound: false,
              matchId: numericMatchId,
              streams: [],
            };
          }
        } catch {
          // Fall through to link parsing
        }
      }

      // Resolve streams
      let streams: PublicStreamEntry[] = [];

      // 1. Attempt resolution via centralized VNRES catalog
      const fixtureQuery = extractFixtureQueryFromButtonsHtml(html);
      let target: VnresTargetFixture | null = fixtureQuery;

      if (!target && validation.type === 'match_slug') {
        const slugParsed = parseSlug(validation.raw);
        if (slugParsed.homeName && slugParsed.awayName) {
          target = {
            homeTeam: slugParsed.homeName,
            awayTeam: slugParsed.awayName,
            rawTitle: `${slugParsed.homeName} vs ${slugParsed.awayName}`,
          };
        }
      }

      if (target && target.homeTeam && target.awayTeam) {
        try {
          const catalogRes = await resolveVnresCatalogStreams(target, {
            isAuthorized: deps?.catalogAuthorized,
            fetchFn: deps?.catalogFetchFn || customFetch,
          });

          if (catalogRes.authorized && catalogRes.matched && catalogRes.streams.length > 0) {
            streams = catalogRes.streams;
          }
        } catch (catErr: any) {
          console.warn(`[StreamsService] VNRES catalog resolution error for ${numericMatchId}:`, catErr.message);
          // Never swallow coordination waiter timeouts into false empty-stream responses (F-22-01)
          if (
            catErr instanceof CoordinationTimeoutError ||
            catErr.code === 'ANOTHER_WORKER_FETCHING' ||
            catErr.isCoordinationError
          ) {
            throw catErr;
          }
          if (catErr instanceof VnresUpstreamError || catErr.isUpstreamOutage) {
            throw new UpstreamProviderError(catErr.message, catErr.statusCode || 503, catErr.retryAfter || 30);
          }
          // Propagate unexpected errors as upstream provider errors rather than silently converting to empty streams
          throw new UpstreamProviderError(
            `Failed to resolve stream catalog for match: ${catErr?.message || 'unexpected error'}`,
            503,
            30
          );
        }
      }

      // 2. Fall back to parsing direct HLS links from match buttons HTML if catalog produced no streams
      if (streams.length === 0) {
        streams = parseTotalSportsButtonsHtml(html, numericMatchId);
      }

      return {
        notFound: false,
        matchId: numericMatchId,
        streams,
      };
    };

  const swrResult: SWRResult<InternalStreamFetchResult> = await getOrFetchWithSWR(
    cacheKey,
    fetchStreamsLive,
    CACHE_PROFILES.STREAMS
  );

  if (swrResult.data.notFound) {
    throw new MatchNotFoundError(`Match ${numericMatchId} not found upstream`);
  }

  // Guarantee: Never serve expired signed URLs from cache or stale fallback.
  // Safety window harmonized to 30 seconds (30,000ms).
  const activeStreams = swrResult.data.streams.filter(
    (stream) => !isSignedUrlExpired(stream.url, 30_000)
  );

  // Remediation for Phase 2.18 Finding F-05:
  // When cached stream tokens expire during the stale or cache window, DO NOT return hasStreams: false
  // if the match originally had streams. Attempt controlled revalidation.
  if (swrResult.data.streams.length > 0 && activeStreams.length === 0) {
    try {
      await invalidateCacheKey(cacheKey);
      const freshData = await fetchStreamsLive();
      const freshActive = freshData.streams.filter(
        (stream) => !isSignedUrlExpired(stream.url, 30_000)
      );

      if (freshActive.length > 0) {
        return {
          data: {
            matchId: freshData.matchId,
            hasStreams: true,
            streams: freshActive,
          },
          source: 'MISS',
        };
      }

      // If revalidation cannot produce active unexpired streams, return safe unavailable error
      // rather than falsely asserting that the broadcast ended.
      throw new UpstreamProviderError(
        'Upstream stream authorization is refreshing. Please retry shortly.',
        503,
        3
      );
    } catch (revalErr: any) {
      if (revalErr instanceof MatchNotFoundError) {
        throw revalErr;
      }
      if (revalErr instanceof UpstreamProviderError) {
        throw revalErr;
      }
      if (
        revalErr instanceof CoordinationTimeoutError ||
        revalErr.code === 'ANOTHER_WORKER_FETCHING' ||
        revalErr.isCoordinationError
      ) {
        throw revalErr;
      }
      throw new UpstreamProviderError(
        `Upstream stream revalidation failed: ${revalErr?.message || 'temporary error'}`,
        503,
        3
      );
    }
  }

  return {
    data: {
      matchId: swrResult.data.matchId,
      hasStreams: activeStreams.length > 0,
      streams: activeStreams,
    },
    source: swrResult.source,
    retryAfter: swrResult.retryAfter,
  };
}
