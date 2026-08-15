/**
 * Server-side utility to fetch upcoming fixtures from TotalSportsLive.
 * Used by sitemap.ts, homepage server component, and any server context
 * that needs to know about upcoming match slugs ahead of time.
 *
 * This fetches fixtures for the next 14 days so match pages are
 * discoverable by Google well before kickoff.
 */
import {
  getFormattedDateString,
  parseRawEventToMatch,
  LivescoreResponseRaw,
} from './totalsports-api';
import { Match } from './matches-data';

const UPCOMING_DAYS = 14;
const BACKEND_BASE = 'https://king.totalsportslive.co.zw/api/livescore';

/**
 * Fetch all fixtures for a single date from the upstream livescore provider.
 * Runs server-side only. Uses Next.js fetch cache to avoid hammering upstream.
 */
async function fetchFixturesForDate(
  dateStr: string,
  dateLabel: string,
  revalidateSeconds: number,
): Promise<Match[]> {
  try {
    const res = await fetch(
      `${BACKEND_BASE}?date=${dateStr}&t=${Date.now()}`,
      { next: { revalidate: revalidateSeconds } },
    );
    if (!res.ok) return [];

    const data: LivescoreResponseRaw = await res.json();
    const matches: Match[] = [];

    if (data.Stages) {
      data.Stages.forEach((stage) => {
        if (stage.Events) {
          stage.Events.forEach((event) => {
            matches.push(
              parseRawEventToMatch(event, stage.Snm, stage.Cnm, dateLabel),
            );
          });
        }
      });
    }

    return matches;
  } catch (err) {
    console.error(`[upcoming-fixtures] Error fetching date ${dateStr}:`, err);
    return [];
  }
}

/**
 * Human-readable date label for a date offset from today.
 */
function getDateLabel(offsetDays: number): string {
  if (offsetDays === -1) return 'Yesterday';
  if (offsetDays === 0) return 'Today';
  if (offsetDays === 1) return 'Tomorrow';

  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export interface UpcomingFixture {
  slug: string;
  homeName: string;
  awayName: string;
  competition: string;
  kickoffTime: string;
  /** ISO 8601 date string for the match start */
  startDate: string;
  status: 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED';
  esd?: string;
  category: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA';
}

/**
 * Convert a Match to a lightweight UpcomingFixture for sitemap/linking.
 */
function toUpcomingFixture(m: Match): UpcomingFixture {
  let startDate: string;
  if (m.esd && m.esd.length >= 12) {
    const yyyy = m.esd.slice(0, 4);
    const mm = m.esd.slice(4, 6);
    const dd = m.esd.slice(6, 8);
    const hh = m.esd.slice(8, 10);
    const min = m.esd.slice(10, 12);
    startDate = `${yyyy}-${mm}-${dd}T${hh}:${min}:00+02:00`;
  } else {
    startDate = new Date().toISOString();
  }

  return {
    slug: m.slug,
    homeName: m.teams.home.name,
    awayName: m.teams.away.name,
    competition: m.competition,
    kickoffTime: m.kickoffTime,
    startDate,
    status: m.status,
    esd: m.esd,
    category: m.category,
  };
}

/**
 * Fetch upcoming fixtures for the next `days` days (default 14).
 * Returns lightweight UpcomingFixture objects suitable for sitemap
 * generation and server-rendered link sections.
 *
 * Revalidation strategy:
 *  - Today: 60s (scores change)
 *  - Tomorrow: 300s
 *  - 2–14 days out: 1800s (schedules rarely change)
 */
export async function getUpcomingFixtures(
  days: number = UPCOMING_DAYS,
): Promise<UpcomingFixture[]> {
  // Build fetch promises for each day
  const fetches: Promise<Match[]>[] = [];

  for (let offset = 0; offset <= days; offset++) {
    const dateStr = getFormattedDateString(offset);
    const label = getDateLabel(offset);

    let revalidate = 1800; // 2+ days out
    if (offset === 0) revalidate = 60;
    else if (offset === 1) revalidate = 300;

    fetches.push(fetchFixturesForDate(dateStr, label, revalidate));
  }

  const results = await Promise.all(fetches);
  const allMatches = results.flat();

  // Deduplicate by match ID (same match can appear in overlapping windows)
  const seen = new Set<string>();
  const unique: UpcomingFixture[] = [];

  for (const m of allMatches) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      unique.push(toUpcomingFixture(m));
    }
  }

  return unique;
}

/**
 * Fetch only non-finished upcoming fixtures (for sitemap and homepage links).
 */
export async function getUpcomingFixturesForSeo(
  days: number = UPCOMING_DAYS,
): Promise<UpcomingFixture[]> {
  const all = await getUpcomingFixtures(days);
  return all.filter((f) => f.status !== 'FINISHED');
}
