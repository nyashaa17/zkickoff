import {
  getFormattedDateString,
  parseRawEventToMatch,
  LivescoreResponseRaw,
  getTeamColor,
} from './totalsports-api';
import { Match } from './matches-data';
import { getTeamLogoUrl, getLeagueLogoUrl } from './bzzoiro-api';

const BACKEND_BASE = 'https://king.totalsportslive.co.zw/api/livescore';

function getDateLabel(offset: number): string {
  if (offset === -1) return 'Yesterday';
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Fetch all fixtures for a single date from the upstream livescore provider.
 */
export async function fetchMatchesForDate(
  dateStr: string,
  dateLabel: string,
  revalidateSeconds: number
): Promise<Match[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}?date=${dateStr}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return [];

    const data: LivescoreResponseRaw = await res.json();
    const matches: Match[] = [];

    if (data.Stages) {
      data.Stages.forEach((stage) => {
        if (stage.Events) {
          stage.Events.forEach((event) => {
            matches.push(parseRawEventToMatch(event, stage.Snm, stage.Cnm, dateLabel));
          });
        }
      });
    }

    return matches;
  } catch (err) {
    console.error(`[server-matches] Error fetching date ${dateStr}:`, err);
    return [];
  }
}

/**
 * Fetch active window matches (yesterday, today, tomorrow, and next 5 days).
 */
export async function fetchActiveWindowMatches(): Promise<Match[]> {
  const dayConfigs = [
    { offset: -1, label: 'Yesterday', revalidate: 30 },
    { offset: 0, label: 'Today', revalidate: 15 },
    { offset: 1, label: 'Tomorrow', revalidate: 60 },
    { offset: 2, label: getDateLabel(2), revalidate: 300 },
    { offset: 3, label: getDateLabel(3), revalidate: 300 },
    { offset: 4, label: getDateLabel(4), revalidate: 300 },
    { offset: 5, label: getDateLabel(5), revalidate: 300 },
    { offset: 6, label: getDateLabel(6), revalidate: 300 },
  ];

  try {
    const results = await Promise.all(
      dayConfigs.map((cfg) => {
        const dateStr = getFormattedDateString(cfg.offset);
        return fetchMatchesForDate(dateStr, cfg.label, cfg.revalidate);
      })
    );
    return results.flat();
  } catch (err) {
    console.error('[server-matches] Error fetching active window matches:', err);
    return [];
  }
}

/**
 * Enrich a single match with Bzzoiro dynamic logos.
 */
export async function enrichMatchWithLogos(m: Match): Promise<Match> {
  try {
    const [homeLogo, awayLogo, leagueLogo] = await Promise.all([
      getTeamLogoUrl(m.teams.home.name),
      getTeamLogoUrl(m.teams.away.name),
      getLeagueLogoUrl(m.competition),
    ]);

    return {
      ...m,
      teams: {
        home: {
          ...m.teams.home,
          logoUrl: homeLogo || m.teams.home.logoUrl,
          bzzBadge: homeLogo || m.teams.home.bzzBadge || null,
        },
        away: {
          ...m.teams.away,
          logoUrl: awayLogo || m.teams.away.logoUrl,
          bzzBadge: awayLogo || m.teams.away.bzzBadge || null,
        },
      },
      leagueLogoUrl: leagueLogo || m.leagueLogoUrl,
    };
  } catch (err) {
    console.error(`[server-matches] Error enriching match logo for ${m.id}:`, err);
    return m;
  }
}

/**
 * Enrich an array of matches with logos in parallel.
 */
export async function enrichMatchesWithLogos(matches: Match[]): Promise<Match[]> {
  try {
    return await Promise.all(matches.map((m) => enrichMatchWithLogos(m)));
  } catch (err) {
    console.error('[server-matches] enrichMatchesWithLogos error:', err);
    return matches;
  }
}

export interface ParsedSlug {
  isParseable: boolean;
  homeName: string;
  awayName: string;
  id: string;
}

/**
 * Parse team names and ID from fixture slug.
 * Distinguishes well-formed slugs (e.g. 'arsenal-vs-chelsea-123456') from malformed inputs.
 */
export function parseSlug(slug: string): ParsedSlug {
  if (!slug || typeof slug !== 'string') {
    return { isParseable: false, homeName: '', awayName: '', id: '0' };
  }

  const vsIndex = slug.indexOf('-vs-');
  if (vsIndex === -1) {
    return { isParseable: false, homeName: '', awayName: '', id: '0' };
  }

  const homeRaw = slug.slice(0, vsIndex).trim();
  const awayAndIdRaw = slug.slice(vsIndex + 4).trim();

  if (!homeRaw || !awayAndIdRaw) {
    return { isParseable: false, homeName: '', awayName: '', id: '0' };
  }

  // Extract trailing numeric ID from away part if present (e.g., chelsea-123456)
  const lastHyphen = awayAndIdRaw.lastIndexOf('-');
  let awayRaw = awayAndIdRaw;
  let id = '0';

  if (lastHyphen !== -1) {
    const potentialId = awayAndIdRaw.slice(lastHyphen + 1);
    const potentialAway = awayAndIdRaw.slice(0, lastHyphen);
    if (/^\d+$/.test(potentialId) && potentialAway.length > 0) {
      awayRaw = potentialAway;
      id = potentialId;
    }
  }

  const formatTeamName = (raw: string) =>
    raw
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  const homeName = formatTeamName(homeRaw);
  const awayName = formatTeamName(awayRaw);

  if (!homeName || !awayName) {
    return { isParseable: false, homeName: '', awayName: '', id: '0' };
  }

  return { isParseable: true, homeName, awayName, id };
}

/**
 * Backward-compatible wrapper for slug fallback parsing.
 */
export function parseSlugFallback(slug: string) {
  const { homeName, awayName, id } = parseSlug(slug);
  return {
    homeName: homeName || 'Home Team',
    awayName: awayName || 'Away Team',
    id: id || '0',
  };
}

export interface MatchPreviewResult {
  match: Match | null;
  allMatches: Match[];
  isParseable: boolean;
  isFeedMatch: boolean;
}

/**
 * Server-side helper to get authoritative match data for a fixture slug before render.
 * Cross-checks active window (and extended schedule if needed) and enriches with Bzzoiro logos.
 * For well-formed slugs not found in the feed (e.g. friendlies), provides an honest fallback without fake data.
 */
export async function getMatchForPreview(slug: string): Promise<MatchPreviewResult> {
  const { isParseable, homeName, awayName, id: matchId } = parseSlug(slug);

  // If the slug cannot be parsed into two teams at all (e.g. malformed/garbage input), return unparseable
  if (!isParseable) {
    return {
      match: null,
      allMatches: [],
      isParseable: false,
      isFeedMatch: false,
    };
  }

  // 1. Fetch active window matches (Yesterday, Today, Tomorrow, +2 to +6 days)
  const allMatches = await fetchActiveWindowMatches();

  // 2. Try finding match by ID or slug in active window
  let foundMatch = allMatches.find((m) => (matchId !== '0' && m.id === matchId) || m.slug === slug);

  // 3. If not found in 8-day window, search extended window (7 to 14 days out)
  if (!foundMatch && matchId !== '0') {
    const extendedFetches: Promise<Match[]>[] = [];
    for (let offset = 7; offset <= 14; offset++) {
      const dateStr = getFormattedDateString(offset);
      const label = getDateLabel(offset);
      extendedFetches.push(fetchMatchesForDate(dateStr, label, 1800));
    }
    const extendedResults = await Promise.all(extendedFetches);
    const extendedMatches = extendedResults.flat();
    foundMatch = extendedMatches.find((m) => (matchId !== '0' && m.id === matchId) || m.slug === slug);
    if (foundMatch) {
      allMatches.push(...extendedMatches);
    }
  }

  // 4. Enrich found match or create honest fallback for well-formed slugs not in feed
  let enrichedMatch: Match | null = null;
  let isFeedMatch = false;

  if (foundMatch) {
    enrichedMatch = await enrichMatchWithLogos(foundMatch);
    enrichedMatch.isFeedMatch = true;
    isFeedMatch = true;
  } else {
    // Honest fallback for real matches not present in upstream feed (e.g. friendlies)
    // Fetch team logos independently so OG image and preview render correctly without fabricated score/venue
    const [homeLogo, awayLogo] = await Promise.all([
      getTeamLogoUrl(homeName),
      getTeamLogoUrl(awayName),
    ]);

    enrichedMatch = {
      id: matchId,
      slug,
      teams: {
        home: {
          name: homeName,
          code: homeName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'T'),
          logoColor: getTeamColor(homeName),
          logoUrl: homeLogo,
          bzzBadge: homeLogo || null,
        },
        away: {
          name: awayName,
          code: awayName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'T'),
          logoColor: getTeamColor(awayName),
          logoUrl: awayLogo,
          bzzBadge: awayLogo || null,
        },
      },
      status: 'UPCOMING',
      competition: 'Match Preview',
      kickoffTime: 'TBD',
      dateString: 'Upcoming',
      category: 'INTERNATIONAL',
      venue: undefined,
      spectators: undefined,
      servers: [],
      isFeedMatch: false,
    };
  }

  // Enrich related matches (up to 15) so sidebar displays logos instantly
  const previewSlice = allMatches.slice(0, 15);
  const enrichedAllMatches = await enrichMatchesWithLogos(previewSlice);

  return {
    match: enrichedMatch,
    allMatches: enrichedAllMatches,
    isParseable: true,
    isFeedMatch,
  };
}
