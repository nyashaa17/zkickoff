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
  category: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA';
  venue: string;
  spectators: string;
  servers: {
    id: string;
    name: string;
    embedUrl: string;
  }[];
}

export const mockMatches: Match[] = [
  {
    id: "dynamos-highlanders-zpsl",
    slug: "dynamos-vs-highlanders",
    teams: {
      home: { name: "Dynamos FC", code: "DYN", logoColor: "#0056B3" },
      away: { name: "Highlanders FC", code: "HIG", logoColor: "#111111" }
    },
    score: { home: 1, away: 0 },
    status: "LIVE",
    minute: 74,
    competition: "Zimbabwe Premier Soccer League",
    kickoffTime: "15:00",
    dateString: "Today",
    category: "ZPSL",
    venue: "National Sports Stadium, Harare",
    spectators: "45,000",
    servers: [
      { id: "srv1", name: "SuperStream Zimbabwe (Server 1 - FHD)", embedUrl: "https://www.youtube.com/embed/3A-Hqf4Z7g8?autoplay=1&mute=1" },
      { id: "srv2", name: "ZBC TV Live Alternative (Server 2 - HD)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" },
      { id: "srv3", name: "ZimKickOff Premium (Server 3 - Mobile LQ)", embedUrl: "https://www.youtube.com/embed/9XnEps08KzM?autoplay=1&mute=1" }
    ]
  },
  {
    id: "caps-united-manica-zpsl",
    slug: "caps-united-vs-manica-diamonds",
    teams: {
      home: { name: "CAPS United", code: "CAP", logoColor: "#009739" },
      away: { name: "Manica Diamonds", code: "MND", logoColor: "#FFD100" }
    },
    score: { home: 2, away: 2 },
    status: "LIVE",
    minute: 38,
    competition: "Zimbabwe Premier Soccer League",
    kickoffTime: "15:00",
    dateString: "Today",
    category: "ZPSL",
    venue: "Rufaro Stadium, Harare",
    spectators: "18,500",
    servers: [
      { id: "srv1", name: "Rufaro Sports Live (Server 1 - HD)", embedUrl: "https://www.youtube.com/embed/9XnEps08KzM?autoplay=1&mute=1" },
      { id: "srv2", name: "CAPS TV (Server 2)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" }
    ]
  },
  {
    id: "fc-platinum-chicken-inn",
    slug: "fc-platinum-vs-chicken-inn",
    teams: {
      home: { name: "FC Platinum", code: "FCP", logoColor: "#007a33" },
      away: { name: "Chicken Inn FC", code: "CHI", logoColor: "#D62828" }
    },
    score: { home: 0, away: 0 },
    status: "TODAY",
    competition: "Zimbabwe Premier Soccer League",
    kickoffTime: "17:30",
    dateString: "Today",
    category: "ZPSL",
    venue: "Mandava Stadium, Zvishavane",
    spectators: "12,000",
    servers: [
      { id: "srv1", name: "Mandava Broadcasters (Server 1)", embedUrl: "https://www.youtube.com/embed/3A-Hqf4Z7g8?autoplay=1&mute=1" },
      { id: "srv2", name: "Chicken Inn Fan Stream (Server 2)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" }
    ]
  },
  {
    id: "arsenal-chelsea-epl",
    slug: "arsenal-vs-chelsea",
    teams: {
      home: { name: "Arsenal", code: "ARS", logoColor: "#D62828" },
      away: { name: "Chelsea", code: "CHE", logoColor: "#003bff" }
    },
    score: { home: 0, away: 0 },
    status: "TODAY",
    competition: "English Premier League",
    kickoffTime: "19:00",
    dateString: "Today",
    category: "INTERNATIONAL",
    venue: "Emirates Stadium, London",
    spectators: "60,700",
    servers: [
      { id: "srv1", name: "EPL Stream 1 (FHD)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" },
      { id: "srv2", name: "EPL Stream 2 (HD)", embedUrl: "https://www.youtube.com/embed/3A-Hqf4Z7g8?autoplay=1" }
    ]
  },
  {
    id: "real-madrid-barcelona-la-liga",
    slug: "real-madrid-vs-barcelona",
    teams: {
      home: { name: "Real Madrid", code: "RMA", logoColor: "#f1f1f1" },
      away: { name: "Barcelona", code: "FCB", logoColor: "#740030" }
    },
    status: "UPCOMING",
    competition: "La Liga Santander",
    kickoffTime: "21:00",
    dateString: "Today",
    category: "INTERNATIONAL",
    venue: "Santiago Bernabéu, Madrid",
    spectators: "81,000",
    servers: [
      { id: "srv1", name: "LaLiga Live Global (FHD)", embedUrl: "https://www.youtube.com/embed/3A-Hqf4Z7g8?autoplay=1" },
      { id: "srv2", name: "LaLiga Alternative (HD)", embedUrl: "https://www.youtube.com/embed/9XnEps08KzM?autoplay=1" }
    ]
  },
  {
    id: "zimbabwe-south-africa-afcon",
    slug: "zimbabwe-vs-south-africa",
    teams: {
      home: { name: "Zimbabwe Warriors", code: "ZIM", logoColor: "#009739" },
      away: { name: "South Africa Bafana", code: "RSA", logoColor: "#FFD100" }
    },
    status: "UPCOMING",
    competition: "CAF World Cup Qualifiers",
    kickoffTime: "15:00",
    dateString: "Tomorrow",
    category: "AFRICA",
    venue: "Orlando Stadium, Johannesburg",
    spectators: "40,000",
    servers: [
      { id: "srv1", name: "CAF TV Live Official (FHD)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" },
      { id: "srv2", name: "SuperSport stream fallback (HD)", embedUrl: "https://www.youtube.com/embed/3A-Hqf4Z7g8?autoplay=1" }
    ]
  },
  {
    id: "manchester-united-liverpool-epl",
    slug: "manchester-united-vs-liverpool",
    teams: {
      home: { name: "Manchester United", code: "MUN", logoColor: "#da020e" },
      away: { name: "Liverpool", code: "LIV", logoColor: "#c8102e" }
    },
    status: "UPCOMING",
    competition: "English Premier League",
    kickoffTime: "17:30",
    dateString: "Tomorrow",
    category: "INTERNATIONAL",
    venue: "Old Trafford, Manchester",
    spectators: "74,311",
    servers: [
      { id: "srv1", name: "EPL Stream 1 (FHD)", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" }
    ]
  }
];

export function getMatches(): Match[] {
  return mockMatches;
}

export function getMatchBySlug(slug: string): Match | undefined {
  return mockMatches.find((m) => m.slug === slug);
}

export function searchMatches(query: string): Match[] {
  const q = query.toLowerCase();
  if (!q) return [];
  return mockMatches.filter(
    (m) =>
      m.teams.home.name.toLowerCase().includes(q) ||
      m.teams.away.name.toLowerCase().includes(q) ||
      m.teams.home.code.toLowerCase().includes(q) ||
      m.teams.away.code.toLowerCase().includes(q) ||
      m.competition.toLowerCase().includes(q)
  );
}
