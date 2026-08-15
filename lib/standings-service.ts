import { LeagueConfig, getLeagueBySlug } from './leagues-config';

export interface StandingsRow {
  position: number;
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  xgf?: number;
  xga?: number;
  xgd?: number;
  xg_games?: number;
  form?: string | string[];
  live?: boolean;
}

export interface StandingsResult {
  league: LeagueConfig;
  seasonName?: string;
  seasonYear?: number;
  isGrouped: boolean;
  standings?: StandingsRow[];
  groups?: Record<string, StandingsRow[]>;
  updatedAt: string;
  error?: string;
}

export async function fetchLeagueStandings(slug: string): Promise<StandingsResult | null> {
  const league = getLeagueBySlug(slug);
  if (!league) return null;

  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    console.error('[Standings] BZZOIRO_API_KEY is not configured');
    return {
      league,
      isGrouped: !!league.isGrouped,
      standings: [],
      updatedAt: new Date().toISOString(),
      error: 'API key not configured'
    };
  }

  const headers = {
    'Authorization': `Token ${apiKey}`,
    'Accept': 'application/json'
  };

  try {
    // 1. Fetch standings data and league metadata in parallel
    const [standingsRes, leagueRes] = await Promise.all([
      fetch(`https://sports.bzzoiro.com/api/v2/leagues/${league.id}/standings/`, {
        headers,
        next: { revalidate: 300 } // 5 minutes ISR cache
      }),
      fetch(`https://sports.bzzoiro.com/api/v2/leagues/${league.id}/`, {
        headers,
        next: { revalidate: 86400 } // 24 hours cache for metadata
      })
    ]);

    let seasonName = '2026/2027';
    let seasonYear = 2026;

    if (leagueRes.ok) {
      const lData = await leagueRes.json();
      if (lData?.current_season?.name) {
        seasonName = lData.current_season.name;
        seasonYear = lData.current_season.year || 2026;
      }
    }

    if (!standingsRes.ok) {
      console.warn(`[Standings] Bzzoiro returned ${standingsRes.status} for league ${league.slug} (${league.id})`);
      return {
        league,
        seasonName,
        seasonYear,
        isGrouped: !!league.isGrouped,
        standings: [],
        updatedAt: new Date().toISOString()
      };
    }

    const data = await standingsRes.json();
    const isGrouped = data.grouped === true || (data.groups && Object.keys(data.groups).length > 0);

    return {
      league,
      seasonName,
      seasonYear,
      isGrouped: !!isGrouped,
      standings: Array.isArray(data.standings) ? data.standings : [],
      groups: data.groups || undefined,
      updatedAt: new Date().toISOString()
    };
  } catch (err: any) {
    console.error(`[Standings] Error fetching standings for ${slug}:`, err);
    return {
      league,
      isGrouped: !!league.isGrouped,
      standings: [],
      updatedAt: new Date().toISOString(),
      error: err.message
    };
  }
}
