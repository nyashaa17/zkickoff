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
  leagueLogoUrl?: string; // Explicit league logo from Bzzoiro Sports API
  kickoffTime: string; // e.g., "15:00"
  dateString: string;  // e.g., "Today", "Tomorrow"
  esd?: string;        // Raw start datetime (YYYYMMDDHHMMSS)
  category: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA';
  venue: string;
  spectators: string;
  servers: {
    id: string;
    name: string;
    embedUrl: string;
  }[];
}


