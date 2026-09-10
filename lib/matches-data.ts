import { findLeagueConfig, getLeagueBySlug } from './leagues-config';

export interface Team {
  name: string;
  code: string;
  logoColor: string; // High-fidelity color representation of the team jersey
  logoUrl?: string;  // Explicit brand/badge logo from Bzzoiro Sports API
  bzzBadge?: string | null;
  lsBadge?: string | null;
}

export interface Match {
  id: string;
  slug: string;
  teams: {
    home: Team;
    away: Team;
  };
  score?: {
    home: number;
    away: number;
  };
  status: 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED';
  minute?: number;
  eps?: string;
  competition: string;
  leagueId?: string;
  region?: string;
  leagueSlug?: string | null;
  leagueLogoUrl?: string; // Explicit league logo from Bzzoiro Sports API
  kickoffTime: string; // e.g., "15:00"
  dateString: string;  // e.g., "Today", "Tomorrow"
  esd?: string;        // Raw start datetime (YYYYMMDDHHMMSS)
  category: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA';
  venue?: string;
  spectators?: string;
  servers: {
    id: string;
    name: string;
    embedUrl: string;
  }[];
  isFeedMatch?: boolean;
}

export interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  region: string;
  leagueSlug?: string | null;
  leagueLogoUrl?: string;
  tableUrl?: string | null;
  matches: Match[];
}

function slugifyKey(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Transforms a flat match array into deterministic league groups
 * keyed by league: { leagueId, leagueName, region, matches: [...] }.
 * Preserves the upstream feed order and avoids re-sorting during render.
 */
export function groupMatchesByLeague(matches: Match[]): LeagueGroup[] {
  if (!matches || matches.length === 0) return [];

  const groupsMap = new Map<string, LeagueGroup>();

  for (const match of matches) {
    const leagueConfig = match.leagueSlug
      ? getLeagueBySlug(match.leagueSlug)
      : findLeagueConfig(match.competition, match.region);

    const leagueId = leagueConfig
      ? String(leagueConfig.id)
      : (match.leagueId || slugifyKey(match.competition || 'football-league'));

    const leagueName = match.competition || (leagueConfig ? leagueConfig.name : 'Football League');
    const region = match.region || (leagueConfig ? leagueConfig.country : 'International');
    const leagueSlug = leagueConfig?.slug || match.leagueSlug || null;
    const tableUrl = leagueSlug ? `/league/${leagueSlug}` : null;
    const leagueLogoUrl = match.leagueLogoUrl || (leagueConfig ? `https://sports.bzzoiro.com/img/league/${leagueConfig.id}` : undefined);

    let group = groupsMap.get(leagueId);
    if (!group) {
      group = {
        leagueId,
        leagueName,
        region,
        leagueSlug,
        leagueLogoUrl,
        tableUrl,
        matches: [],
      };
      groupsMap.set(leagueId, group);
    } else {
      if (!group.leagueLogoUrl && leagueLogoUrl) {
        group.leagueLogoUrl = leagueLogoUrl;
      }
    }

    group.matches.push(match);
  }

  return Array.from(groupsMap.values());
}



