import 'server-only';
import { Match } from '@/lib/matches-data';
import { PublicMatch, FixturesQueryParams } from './types';
import { getFormattedDateString } from '@/lib/totalsports-api';

/**
 * Sanitizes an internal ZimKickOff Match object into the public Developer API representation.
 * STRICT SECURITY REQUIREMENT:
 * Excises all stream URLs, Vicecap embed URLs, HLS manifests, servers, tokens, and internal provider credentials.
 */
export function sanitizePublicMatch(match: Match): PublicMatch {
  // Convert esd (YYYYMMDDHHMMSS) to ISO 8601 UTC timestamp if available
  let timestamp: string | undefined = undefined;
  if (match.esd && match.esd.length === 14) {
    const yyyy = match.esd.slice(0, 4);
    const mm = match.esd.slice(4, 6);
    const dd = match.esd.slice(6, 8);
    const hh = match.esd.slice(8, 10);
    const min = match.esd.slice(10, 12);
    const ss = match.esd.slice(12, 14);
    timestamp = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
  }

  // Derive normalized YYYY-MM-DD date string
  let normalizedDate = match.dateString;
  if (match.esd && match.esd.length >= 8) {
    normalizedDate = `${match.esd.slice(0, 4)}-${match.esd.slice(4, 6)}-${match.esd.slice(6, 8)}`;
  }

  return {
    id: String(match.id),
    slug: match.slug,
    status: match.status,
    minute: match.minute,
    eps: match.eps,
    score: match.score ? {
      home: Number(match.score.home),
      away: Number(match.score.away),
    } : null,
    teams: {
      home: {
        name: match.teams.home.name,
        code: match.teams.home.code,
        logoUrl: match.teams.home.logoUrl || (match.teams.home as any).bzzBadge || undefined,
        logoColor: match.teams.home.logoColor,
      },
      away: {
        name: match.teams.away.name,
        code: match.teams.away.code,
        logoUrl: match.teams.away.logoUrl || (match.teams.away as any).bzzBadge || undefined,
        logoColor: match.teams.away.logoColor,
      },
    },
    competition: {
      id: match.leagueId,
      name: match.competition,
      region: match.region,
      slug: match.leagueSlug || null,
      logoUrl: match.leagueLogoUrl,
    },
    kickoffTime: match.kickoffTime,
    date: normalizedDate,
    timestamp,
    venue: match.venue,
    category: match.category,
  };
}

/**
 * Validates and converts date input to YYYYMMDD string for TotalSportsLive provider.
 * Allows:
 * - 'today' (default) -> offset 0
 * - 'tomorrow' -> offset 1
 * - 'yesterday' -> offset -1
 * - 'YYYY-MM-DD' (within range -3 days past to +7 days future)
 */
export function validateAndFormatDateParam(dateParam?: string | null): {
  valid: boolean;
  dateStr?: string;
  dateLabel?: string;
  errorMessage?: string;
} {
  if (!dateParam || dateParam.toLowerCase() === 'today') {
    return {
      valid: true,
      dateStr: getFormattedDateString(0),
      dateLabel: 'Today',
    };
  }

  const normalized = dateParam.trim().toLowerCase();

  if (normalized === 'yesterday') {
    return {
      valid: true,
      dateStr: getFormattedDateString(-1),
      dateLabel: 'Yesterday',
    };
  }

  if (normalized === 'tomorrow') {
    return {
      valid: true,
      dateStr: getFormattedDateString(1),
      dateLabel: 'Tomorrow',
    };
  }

  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalized)) {
    return {
      valid: false,
      errorMessage: `Invalid date format '${dateParam}'. Accepted values: 'today', 'tomorrow', 'yesterday', or 'YYYY-MM-DD'.`,
    };
  }

  const parsed = new Date(normalized + 'T00:00:00Z');
  if (isNaN(parsed.getTime())) {
    return {
      valid: false,
      errorMessage: `Invalid calendar date '${dateParam}'.`,
    };
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffDays = Math.round((parsed.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < -3 || diffDays > 7) {
    return {
      valid: false,
      errorMessage: `Date '${dateParam}' is outside the supported query range (-3 days past to +7 days future).`,
    };
  }

  const yyyy = String(parsed.getUTCFullYear());
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getUTCDate()).padStart(2, '0');

  return {
    valid: true,
    dateStr: `${yyyy}${mm}${dd}`,
    dateLabel: `${dd}/${mm}/${yyyy}`,
  };
}

/**
 * Filters a list of public matches by competition, status, and applies pagination.
 */
export function filterAndPaginateMatches(
  matches: PublicMatch[],
  params: FixturesQueryParams
): {
  data: PublicMatch[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
} {
  let filtered = matches;

  // Filter by competition (case-insensitive slug or name match)
  if (params.competition) {
    const compQuery = params.competition.toLowerCase().trim();
    filtered = filtered.filter((m) => {
      const nameMatch = m.competition.name?.toLowerCase().includes(compQuery);
      const slugMatch = m.competition.slug?.toLowerCase().includes(compQuery);
      const idMatch = m.competition.id?.toLowerCase() === compQuery;
      return nameMatch || slugMatch || idMatch;
    });
  }

  // Filter by status (LIVE, UPCOMING, FINISHED, ALL)
  if (params.status && params.status.toUpperCase() !== 'ALL') {
    const statusQuery = params.status.toUpperCase().trim();
    filtered = filtered.filter((m) => m.status === statusQuery);
  }

  const total = filtered.length;
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < total;

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      hasMore,
    },
  };
}
