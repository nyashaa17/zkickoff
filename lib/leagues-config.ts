export interface LeagueZoneRule {
  range: [number, number]; // [minRank, maxRank] inclusive
  label: string;
  shortLabel: string;
  badgeClass: string;
  borderClass: string;
  colorType: 'ucl' | 'uel' | 'uecl' | 'promo' | 'playoff' | 'relegation' | 'qual';
}

export interface LeagueConfig {
  id: number; // Bzzoiro league ID
  slug: string;
  name: string;
  shortName: string;
  country: string;
  region: 'England' | 'Spain' | 'Italy' | 'Germany' | 'France' | 'Europe' | 'Africa' | 'Americas' | 'International';
  flag: string;
  isGrouped?: boolean;
  teamCount?: number;
  featured?: boolean;
  zones?: LeagueZoneRule[];
}

export const LEAGUES_REGISTRY: LeagueConfig[] = [
  // 1. Premier League
  {
    id: 1,
    slug: 'premier-league',
    name: 'Premier League',
    shortName: 'EPL',
    country: 'England',
    region: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    teamCount: 20,
    featured: true,
    zones: [
      { range: [1, 4], label: 'UEFA Champions League (League Phase)', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [5, 5], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [6, 6], label: 'UEFA Conference League Play-offs', shortLabel: 'UECL', badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-200', borderClass: 'border-l-purple-500', colorType: 'uecl' },
      { range: [18, 20], label: 'Relegation to Championship', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 2. La Liga
  {
    id: 3,
    slug: 'la-liga',
    name: 'La Liga',
    shortName: 'LaLiga',
    country: 'Spain',
    region: 'Spain',
    flag: '🇪🇸',
    teamCount: 20,
    featured: true,
    zones: [
      { range: [1, 4], label: 'UEFA Champions League (League Phase)', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [5, 5], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [6, 6], label: 'UEFA Conference League Play-offs', shortLabel: 'UECL', badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-200', borderClass: 'border-l-purple-500', colorType: 'uecl' },
      { range: [18, 20], label: 'Relegation to LaLiga 2', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 3. Serie A
  {
    id: 4,
    slug: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    country: 'Italy',
    region: 'Italy',
    flag: '🇮🇹',
    teamCount: 20,
    featured: true,
    zones: [
      { range: [1, 4], label: 'UEFA Champions League (League Phase)', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [5, 5], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [6, 6], label: 'UEFA Conference League Play-offs', shortLabel: 'UECL', badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-200', borderClass: 'border-l-purple-500', colorType: 'uecl' },
      { range: [18, 20], label: 'Relegation to Serie B', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 4. Bundesliga
  {
    id: 5,
    slug: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    country: 'Germany',
    region: 'Germany',
    flag: '🇩🇪',
    teamCount: 18,
    featured: true,
    zones: [
      { range: [1, 4], label: 'UEFA Champions League (League Phase)', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [5, 5], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [6, 6], label: 'UEFA Conference League Play-offs', shortLabel: 'UECL', badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-200', borderClass: 'border-l-purple-500', colorType: 'uecl' },
      { range: [16, 16], label: 'Relegation Play-offs', shortLabel: 'Playoff', badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-200', borderClass: 'border-l-orange-500', colorType: 'playoff' },
      { range: [17, 18], label: 'Relegation to 2. Bundesliga', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 5. Ligue 1
  {
    id: 6,
    slug: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    country: 'France',
    region: 'France',
    flag: '🇫🇷',
    teamCount: 18,
    featured: true,
    zones: [
      { range: [1, 3], label: 'UEFA Champions League Direct', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [4, 4], label: 'UEFA Champions League Qualifiers', shortLabel: 'UCL Qual', badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', borderClass: 'border-l-indigo-500', colorType: 'qual' },
      { range: [5, 5], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [16, 16], label: 'Relegation Play-offs', shortLabel: 'Playoff', badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-200', borderClass: 'border-l-orange-500', colorType: 'playoff' },
      { range: [17, 18], label: 'Relegation to Ligue 2', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 6. UEFA Champions League
  {
    id: 7,
    slug: 'champions-league',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    country: 'Europe',
    region: 'Europe',
    flag: '🇪🇺',
    teamCount: 36,
    featured: true,
    zones: [
      { range: [1, 8], label: 'Round of 16 (Seeded)', shortLabel: 'R16', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [9, 16], label: 'Knockout Play-offs (Seeded)', shortLabel: 'Playoffs', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [17, 24], label: 'Knockout Play-offs (Unseeded)', shortLabel: 'Playoffs', badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', borderClass: 'border-l-indigo-500', colorType: 'qual' },
      { range: [25, 36], label: 'Eliminated', shortLabel: 'Eliminated', badgeClass: 'bg-neutral-500/10 text-neutral-500 border-neutral-200', borderClass: 'border-l-neutral-400', colorType: 'relegation' }
    ]
  },
  // 7. UEFA Europa League
  {
    id: 8,
    slug: 'europa-league',
    name: 'UEFA Europa League',
    shortName: 'UEL',
    country: 'Europe',
    region: 'Europe',
    flag: '🇪🇺',
    teamCount: 36,
    featured: true,
    zones: [
      { range: [1, 8], label: 'Round of 16 (Seeded)', shortLabel: 'R16', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [9, 24], label: 'Knockout Play-offs', shortLabel: 'Playoffs', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [25, 36], label: 'Eliminated', shortLabel: 'Eliminated', badgeClass: 'bg-neutral-500/10 text-neutral-500 border-neutral-200', borderClass: 'border-l-neutral-400', colorType: 'relegation' }
    ]
  },
  // 8. Championship (England)
  {
    id: 12,
    slug: 'championship',
    name: 'EFL Championship',
    shortName: 'Championship',
    country: 'England',
    region: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    teamCount: 24,
    featured: true,
    zones: [
      { range: [1, 2], label: 'Automatic Promotion to Premier League', shortLabel: 'Promotion', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [3, 6], label: 'Promotion Play-offs', shortLabel: 'Playoffs', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'playoff' },
      { range: [22, 24], label: 'Relegation to League One', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 9. Saudi Pro League
  {
    id: 17,
    slug: 'saudi-pro-league',
    name: 'Saudi Pro League',
    shortName: 'Roshn League',
    country: 'Saudi Arabia',
    region: 'International',
    flag: '🇸🇦',
    teamCount: 18,
    featured: true,
    zones: [
      { range: [1, 3], label: 'AFC Champions League Elite', shortLabel: 'ACL Elite', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [16, 18], label: 'Relegation to First Division', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 10. Major League Soccer (MLS)
  {
    id: 18,
    slug: 'mls',
    name: 'Major League Soccer',
    shortName: 'MLS',
    country: 'USA',
    region: 'Americas',
    flag: '🇺🇸',
    teamCount: 30,
    featured: true,
    zones: [
      { range: [1, 7], label: 'MLS Cup Playoffs (Round One)', shortLabel: 'Playoffs', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [8, 9], label: 'Wild Card Matches', shortLabel: 'Wild Card', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'playoff' }
    ]
  },
  // 11. Brasileirão Serie A
  {
    id: 9,
    slug: 'brasileirao',
    name: 'Brasileirão Serie A',
    shortName: 'Brasileirão',
    country: 'Brazil',
    region: 'Americas',
    flag: '🇧🇷',
    teamCount: 20,
    featured: false,
    zones: [
      { range: [1, 4], label: 'Copa Libertadores Group Stage', shortLabel: 'Libertadores', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [5, 6], label: 'Copa Libertadores Qualifiers', shortLabel: 'Libertadores Qual', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'qual' },
      { range: [7, 12], label: 'Copa Sudamericana', shortLabel: 'Sudamericana', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [17, 20], label: 'Relegation to Serie B', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 12. Eredivisie
  {
    id: 10,
    slug: 'eredivisie',
    name: 'Eredivisie',
    shortName: 'Eredivisie',
    country: 'Netherlands',
    region: 'Europe',
    flag: '🇳🇱',
    teamCount: 18,
    featured: false,
    zones: [
      { range: [1, 2], label: 'UEFA Champions League Direct', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [3, 3], label: 'UEFA Champions League Qualifiers', shortLabel: 'UCL Qual', badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', borderClass: 'border-l-indigo-500', colorType: 'qual' },
      { range: [4, 4], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [16, 16], label: 'Relegation Play-offs', shortLabel: 'Playoff', badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-200', borderClass: 'border-l-orange-500', colorType: 'playoff' },
      { range: [17, 18], label: 'Relegation to Eerste Divisie', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 13. Liga Portugal
  {
    id: 2,
    slug: 'liga-portugal',
    name: 'Liga Portugal Betclic',
    shortName: 'Liga Portugal',
    country: 'Portugal',
    region: 'Europe',
    flag: '🇵🇹',
    teamCount: 18,
    featured: false,
    zones: [
      { range: [1, 2], label: 'UEFA Champions League Direct', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [3, 3], label: 'UEFA Europa League', shortLabel: 'UEL', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-200', borderClass: 'border-l-amber-500', colorType: 'uel' },
      { range: [16, 16], label: 'Relegation Play-offs', shortLabel: 'Playoff', badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-200', borderClass: 'border-l-orange-500', colorType: 'playoff' },
      { range: [17, 18], label: 'Relegation to Liga Portugal 2', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 14. Scottish Premiership
  {
    id: 13,
    slug: 'scottish-premiership',
    name: 'Scottish Premiership',
    shortName: 'Premiership',
    country: 'Scotland',
    region: 'Europe',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    teamCount: 12,
    featured: false,
    zones: [
      { range: [1, 1], label: 'UEFA Champions League Direct', shortLabel: 'UCL', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-200', borderClass: 'border-l-blue-500', colorType: 'ucl' },
      { range: [2, 2], label: 'UEFA Champions League Qualifiers', shortLabel: 'UCL Qual', badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', borderClass: 'border-l-indigo-500', colorType: 'qual' },
      { range: [11, 11], label: 'Relegation Play-offs', shortLabel: 'Playoff', badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-200', borderClass: 'border-l-orange-500', colorType: 'playoff' },
      { range: [12, 12], label: 'Relegation to Championship', shortLabel: 'Relegation', badgeClass: 'bg-red-500/10 text-red-600 border-red-200', borderClass: 'border-l-red-500', colorType: 'relegation' }
    ]
  },
  // 15. CAF Champions League
  {
    id: 29,
    slug: 'caf-champions-league',
    name: 'CAF Champions League',
    shortName: 'CAF CL',
    country: 'Africa',
    region: 'Africa',
    flag: '🌍',
    isGrouped: true,
    featured: true,
    zones: [
      { range: [1, 2], label: 'Quarter-Finals Qualification', shortLabel: 'Quarter-Finals', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', borderClass: 'border-l-emerald-500', colorType: 'promo' },
      { range: [3, 4], label: 'Eliminated', shortLabel: 'Eliminated', badgeClass: 'bg-neutral-500/10 text-neutral-500 border-neutral-200', borderClass: 'border-l-neutral-400', colorType: 'relegation' }
    ]
  }
];

export function getLeagueBySlug(slug: string): LeagueConfig | undefined {
  const norm = (slug || '').toLowerCase().trim();
  return LEAGUES_REGISTRY.find(l => l.slug === norm || l.slug.replace(/-/g, '') === norm.replace(/-/g, ''));
}

export function getZoneForRule(league: LeagueConfig, position: number): LeagueZoneRule | undefined {
  if (!league.zones) return undefined;
  return league.zones.find(z => position >= z.range[0] && position <= z.range[1]);
}

/**
 * Match a raw competition name and optional country/region to a registered LeagueConfig.
 * Guards against false positives across different leagues with identical names (e.g. Algerian Ligue 1 vs French Ligue 1).
 */
export function findLeagueConfig(name: string, region?: string): LeagueConfig | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  const r = (region || '').toLowerCase().trim();

  // Handle ambiguous names with country context first
  if (n === 'serie a' && (r.includes('brazil') || r.includes('brasil'))) {
    return getLeagueBySlug('brasileirao');
  }

  const exact = LEAGUES_REGISTRY.find(
    l => n === l.slug || n === l.name.toLowerCase() || n === l.shortName.toLowerCase()
  );
  if (exact) {
    if (r && exact.country && !r.includes(exact.country.toLowerCase()) && !exact.country.toLowerCase().includes(r)) {
      if (['france', 'england', 'spain', 'italy', 'germany', 'portugal', 'scotland', 'netherlands', 'brazil', 'saudi arabia', 'usa'].includes(exact.country.toLowerCase())) {
        return undefined;
      }
    }
    return exact;
  }

  if (n.includes('premier league') || n.includes('epl')) {
    if (n.includes('english') || r.includes('england') || r === 'europe' || (!r && !n.includes('egypt') && !n.includes('zimbabwe') && !n.includes('south africa') && !n.includes('bahrain') && !n.includes('russia') && !n.includes('ukraine') && !n.includes('scot'))) {
      return getLeagueBySlug('premier-league');
    }
  }
  if (n.includes('la liga') || n.includes('laliga') || n.includes('primera division')) {
    if (!r || r.includes('spain') || r === 'europe') {
      return getLeagueBySlug('la-liga');
    }
  }
  if (n.includes('serie a')) {
    if (r.includes('brazil') || n.includes('brazil') || n.includes('brasileir')) {
      return getLeagueBySlug('brasileirao');
    }
    if (!r || r.includes('italy') || r === 'europe') {
      return getLeagueBySlug('serie-a');
    }
  }
  if (n.includes('bundesliga')) {
    if (!r || r.includes('germany') || r === 'europe') {
      return getLeagueBySlug('bundesliga');
    }
  }
  if (n.includes('ligue 1')) {
    if (r.includes('france') || n.includes('french') || (!r && !n.includes('algeria') && !n.includes('tunisia'))) {
      return getLeagueBySlug('ligue-1');
    }
  }
  if (n.includes('champions league') || n.includes('ucl')) {
    if (n.includes('caf') || r.includes('africa')) {
      return getLeagueBySlug('caf-champions-league');
    }
    if (!r || r.includes('europe') || r.includes('uefa') || r === 'champions league') {
      return getLeagueBySlug('champions-league');
    }
  }
  if (n.includes('europa league') || n.includes('uel')) {
    return getLeagueBySlug('europa-league');
  }
  if (n.includes('championship')) {
    if (!r || r.includes('england') || n.includes('efl')) {
      return getLeagueBySlug('championship');
    }
  }
  if (n.includes('saudi') || n.includes('roshn')) {
    return getLeagueBySlug('saudi-pro-league');
  }
  if (n.includes('mls') || n.includes('major league soccer')) {
    return getLeagueBySlug('mls');
  }
  if (n.includes('brasileir') || n.includes('brasileirao')) {
    return getLeagueBySlug('brasileirao');
  }
  if (n.includes('eredivisie')) {
    return getLeagueBySlug('eredivisie');
  }
  if (n.includes('primeira liga') || n.includes('liga portugal')) {
    return getLeagueBySlug('liga-portugal');
  }
  if (n.includes('scottish premiership') || (n.includes('premiership') && r.includes('scotland'))) {
    return getLeagueBySlug('scottish-premiership');
  }
  if (n.includes('caf champions') || n.includes('caf cl')) {
    return getLeagueBySlug('caf-champions-league');
  }

  return undefined;
}

export function findLeagueSlug(name: string, region?: string): string | null {
  const config = findLeagueConfig(name, region);
  return config ? config.slug : null;
}

export function getLeagueTableUrl(leagueName: string, region?: string): string | null {
  const slug = findLeagueSlug(leagueName, region);
  return slug ? `/league/${slug}` : null;
}

