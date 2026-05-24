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
  'europa league': '8',
  'saudi pro league': '17',
  'mls': '18',
  'j1 league': '49',
  'j-league': '49',
  'j.league': '49',
  'zimbabwe premier soccer league': '45',
  'zimbabwe: premier soccer league': '45',
  'zpsl': '45',
  'caf world cup qualifiers': '10'
};

export function getClientTeamLogo(teamName: string): string | null {
  if (!teamName) return null;
  const normalizedKey = teamName.toLowerCase().trim();
  const sortedTeamKeys = Object.keys(COMMON_TEAM_IDS).sort((a, b) => b.length - a.length);
  const matchedTeamKey = sortedTeamKeys.find(k => {
    if (normalizedKey === k) return true;
    if (normalizedKey.includes(k)) return true;
    if (normalizedKey.length >= 5 && k.includes(normalizedKey)) {
      const genericWords = ['united', 'city', 'town', 'athletic', 'rovers', 'fc', 'sport', 'real', 'cf'];
      if (!genericWords.includes(normalizedKey)) return true;
    }
    return false;
  });
  if (matchedTeamKey) {
    return `https://sports.bzzoiro.com/img/team/${COMMON_TEAM_IDS[matchedTeamKey]}`;
  }
  return null;
}

export function getClientLeagueLogo(leagueName: string): string | null {
  if (!leagueName) return null;
  const normalizedKey = leagueName.toLowerCase().trim();
  const sortedLeagueKeys = Object.keys(COMMON_LEAGUE_IDS).sort((a, b) => b.length - a.length);
  const matchedKey = sortedLeagueKeys.find(k => {
    if (normalizedKey === k) return true;
    if (k === 'premier league') {
      return ['premier league', 'english premier league', 'england: premier league'].includes(normalizedKey);
    }
    return normalizedKey.includes(k) || (normalizedKey.length > 4 && k.includes(normalizedKey));
  });
  if (matchedKey) {
    return `https://sports.bzzoiro.com/img/league/${COMMON_LEAGUE_IDS[matchedKey]}`;
  }
  return null;
}
