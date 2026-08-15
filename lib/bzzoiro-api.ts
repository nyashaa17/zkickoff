/**
 * Bzzoiro Sports Data API integration
 * Leverages the BSD image proxy and v2 search endpoints
 * All queries are safely cached to improve loading times.
 */

const teamIdCache = new Map<string, string | null>();
const leagueIdCache = new Map<string, string | null>();

// High-fidelity preseeded records for zero-latency initial rendering of top clubs
const COMMON_TEAM_IDS: Record<string, string> = {
  // English Premier League
  'arsenal': '18',
  'chelsea': '13',
  'manchester united': '17',
  'man utd': '17',
  'liverpool': '1',
  'manchester city': '12',
  'man city': '12',
  'tottenham': '9',
  'spurs': '9',
  'aston villa': '3',
  'newcastle': '4',
  'everton': '20',
  'west ham': '8',
  'brentford': '16',
  'fulham': '6',
  'bournemouth': '2',
  'crystal palace': '14',
  'wolves': '11',
  'wolverhampton': '11',
  'brighton': '5',
  'nottingham forest': '15',
  'leicester': '221',
  'ipswich': '200',
  'southampton': '205',

  // La Liga (Spain)
  'real madrid': '57',
  'barcelona': '44',
  'fc barcelona': '44',
  'atletico madrid': '54',
  'atletico': '54',
  'valencia': '47',
  'sevilla': '52',
  'girona': '39',
  'real sociedad': '48',

  // Serie A (Italy)
  'juventus': '73',
  'ac milan': '63',
  'milan': '63',
  'inter milan': '77',
  'inter': '77',
  'roma': '65',
  'napoli': '840',
  'lazio': '70',
  'atalanta': '71',
  'fiorentina': '68',

  // Bundesliga (Germany)
  'bayern munich': '1394',
  'bayern': '1394',
  'borussia dortmund': '92',
  'dortmund': '92',
  'bayer leverkusen': '85',
  'leverkusen': '85',
  'rb leipzig': '1857',
  'leipzig': '1857',
  'stuttgart': '84',

  // Ligue 1 (France)
  'psg': '114',
  'paris saint germain': '114',
  'paris saint-germain': '114',
  'marseille': '98',
  'monaco': '101',
  'lille': '106',
  'lyon': '1614',
  'nice': '103',

  // Zimbabwe ZPSL & National
  'dynamos': '595',
  'dynamos fc': '595',
  'highlanders fc': '102',
  'highlanders': '102',
};

const COMMON_LEAGUE_IDS: Record<string, string> = {
  'english premier league': '1',
  'premier league': '1',
  'la liga': '3',
  'la liga santander': '3',
  'laliga': '3',
  'primera division': '3',
  'serie a': '4',
  'bundesliga': '5',
  'ligue 1': '6',
  'champions league': '7',
  'uefa champions league': '7',
  'europa league': '8',
  'uefa europa league': '8',
  'championship': '12',
  'efl championship': '12',
  'saudi pro league': '17',
  'mls': '18',
  'major league soccer': '18',
  'brasileirao': '9',
  'brasileirão': '9',
  'eredivisie': '10',
  'liga portugal': '2',
  'scottish premiership': '13',
  'caf champions league': '29',
  'j1 league': '49',
  'j-league': '49',
  'j.league': '49',
  'zimbabwe premier soccer league': '45',
  'zimbabwe: premier soccer league': '45',
  'zpsl': '45',
  'caf world cup qualifiers': '10'
};

/**
 * Resolves properties to a static team logo image URL via Bzzoiro Sports Data proxy
 */
export async function getTeamLogoUrl(teamName: string): Promise<string | undefined> {
  const normalizedKey = teamName.toLowerCase().trim();
  
  // 1. Check pre-seeded known team IDs to avoid unnecessary network latency
  const sortedTeamKeys = Object.keys(COMMON_TEAM_IDS).sort((a, b) => b.length - a.length);
  const matchedTeamKey = sortedTeamKeys.find(k => {
    if (normalizedKey === k) return true;
    if (normalizedKey.includes(k)) return true;
    if (normalizedKey.length >= 5 && k.includes(normalizedKey)) {
      const genericWords = ['united', 'city', 'town', 'athletic', 'rovers', 'fc', 'sport', 'real', 'cf'];
      if (!genericWords.includes(normalizedKey)) {
        return true;
      }
    }
    return false;
  });

  if (matchedTeamKey) {
    return `https://sports.bzzoiro.com/img/team/${COMMON_TEAM_IDS[matchedTeamKey]}`;
  }
  
  // 2. Check runtime in-memory cache (including negative cache entries)
  if (teamIdCache.has(normalizedKey)) {
    const cachedId = teamIdCache.get(normalizedKey);
    return cachedId ? `https://sports.bzzoiro.com/img/team/${cachedId}` : undefined;
  }

  // 3. Fallback to API query if BZZOIRO_API_KEY is available
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    teamIdCache.set(normalizedKey, null); // Negative cache
    return undefined;
  }

  try {
    const url = `https://sports.bzzoiro.com/api/v2/teams/?name=${encodeURIComponent(teamName)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      cache: 'force-cache'
    });

    if (response.ok) {
      const data = await response.json();
      let teamId: string | null = null;

      if (data && Array.isArray(data.results) && data.results.length > 0) {
        teamId = String(data.results[0].id);
      } else if (data && Array.isArray(data) && data.length > 0) {
        teamId = String(data[0].id);
      }

      if (teamId) {
        teamIdCache.set(normalizedKey, teamId);
        return `https://sports.bzzoiro.com/img/team/${teamId}`;
      }
    }
  } catch (err) {
    console.error(`Bzzoiro API team lookup error for '${teamName}':`, err);
  }

  teamIdCache.set(normalizedKey, null); // Negative cache so we don't repeat failed requests
  return undefined;
}

/**
 * Resolves properties to a static league banner logo shield image URL via the Bzzoiro Sports Data proxy
 */
export async function getLeagueLogoUrl(leagueName: string): Promise<string | undefined> {
  const normalizedKey = leagueName.toLowerCase().trim();

  // 1. Check common pre-seeded league ID mappings
  const sortedLeagueKeys = Object.keys(COMMON_LEAGUE_IDS).sort((a, b) => b.length - a.length);
  const matchedKey = sortedLeagueKeys.find(k => {
    if (normalizedKey === k) return true;
    if (k === 'premier league') {
      return ['premier league', 'english premier league', 'england: premier league', 'england premier league'].includes(normalizedKey);
    }
    return normalizedKey.includes(k) || (normalizedKey.length > 4 && k.includes(normalizedKey));
  });
  if (matchedKey) {
    return `https://sports.bzzoiro.com/img/league/${COMMON_LEAGUE_IDS[matchedKey]}`;
  }

  // 2. Check in-memory cache (including negative cache entries)
  if (leagueIdCache.has(normalizedKey)) {
    const cachedId = leagueIdCache.get(normalizedKey);
    return cachedId ? `https://sports.bzzoiro.com/img/league/${cachedId}` : undefined;
  }

  // 3. Request search from the API
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    leagueIdCache.set(normalizedKey, null); // Negative cache
    return undefined;
  }

  try {
    const url = `https://sports.bzzoiro.com/api/v2/leagues/?country=${encodeURIComponent(leagueName)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      cache: 'force-cache'
    });

    if (response.ok) {
      const data = await response.json();
      let leagueId: string | null = null;

      if (data && Array.isArray(data.results)) {
        const found = data.results.find((l: any) => l.name?.toLowerCase().includes(normalizedKey)) || data.results[0];
        if (found) leagueId = String(found.id);
      } else if (data && Array.isArray(data)) {
        const found = data.find((l: any) => l.name?.toLowerCase().includes(normalizedKey)) || data[0];
        if (found) leagueId = String(found.id);
      }

      if (leagueId) {
        leagueIdCache.set(normalizedKey, leagueId);
        return `https://sports.bzzoiro.com/img/league/${leagueId}`;
      }
    }
  } catch (err) {
    console.error(`Bzzoiro API league lookup error for '${leagueName}':`, err);
  }

  leagueIdCache.set(normalizedKey, null); // Negative cache
  return undefined;
}
