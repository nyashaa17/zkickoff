// TypeScript helpers and integrations for the TotalSportsLive API
import { Match, Team } from './matches-data';

// Helper to generate a URL-friendly slug
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Map known major teams to their signature brands colors for high-fidelity UI representation
export function getTeamColor(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes('dynamo')) return '#0056B3'; // Blue
  if (normalized.includes('highlander')) return '#111111'; // Charcoal/Black
  if (normalized.includes('caps')) return '#009739'; // Green
  if (normalized.includes('platinum')) return '#007a33'; // Deep green
  if (normalized.includes('chicken')) return '#D62828'; // Crimson
  if (normalized.includes('manica')) return '#FFD100'; // Gold
  if (normalized.includes('arsenal')) return '#EF4444'; // Red
  if (normalized.includes('chelsea')) return '#1D4ED8'; // Blue
  if (normalized.includes('united') || normalized.includes('manchester u')) return '#DC2626'; // Red
  if (normalized.includes('city') || normalized.includes('manchester c')) return '#00BFFF'; // Sky Blue
  if (normalized.includes('liverpool')) return '#B91C1C'; // Red
  if (normalized.includes('real madrid')) return '#BDBDBD'; // Light gray
  if (normalized.includes('barcelona')) return '#740030'; // Maroon
  if (normalized.includes('tottenham') || normalized.includes('spur')) return '#0A1C3F'; // Dark blue
  if (normalized.includes('bayern')) return '#DC052D'; // Red
  if (normalized.includes('dortmund')) return '#FDE047'; // Yellow
  if (normalized.includes('juventus')) return '#333333'; // Black/White
  if (normalized.includes('milan')) return '#C20422'; // Rossoneri red
  if (normalized.includes('zimbabwe') || normalized.includes('warrior')) return '#009739'; // Zim Green
  if (normalized.includes('south africa') || normalized.includes('bafana')) return '#FFD100'; // SA Yellow

  // Deterministic fallbacks background coloring based on team name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
    '#EC4899', '#06B6D4', '#14B8A6', '#6366F1', '#84CC16'
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Helper to format Esd (e.g. "20260511190000") to "HH:MM"
export function formatEsTime(esd?: string | number): string {
  if (esd === undefined || esd === null) return 'TBD';
  const esdStr = String(esd);
  if (esdStr.length < 12) return 'TBD';
  const hour = esdStr.slice(8, 10);
  const min = esdStr.slice(10, 12);
  return `${hour}:${min}`;
}

// Helpers to work with Date in YYYYMMDD string format
export function getFormattedDateString(offsetDays = 0): string {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Map the TotalSportsLive Endpoint item to our internal Match layout
export interface ListEventRaw {
  Eid: string; // Event ID
  T1: { Nm: string; Img?: string; ID?: string }[]; // Home team
  T2: { Nm: string; Img?: string; ID?: string }[]; // Away team
  Esd: string | number; // Start datetime (YYYYMMDDHHMMSS)
  Tr1?: string; // T1 score
  Tr2?: string; // T2 score
  Eps: string; // Event status (1H, HT, 2H, FT, NS)
  Ela?: string; // Elapsed minute
  Vnm?: string; // Venue name
}

export interface ListStageRaw {
  Snm: string; // Stage name (League)
  CompN?: string; // Alt competition name
  Cnm: string; // Country name
  Events?: ListEventRaw[];
}

export interface LivescoreResponseRaw {
  Stages: ListStageRaw[];
}

export function parseRawEventToMatch(event: ListEventRaw, stageName: string, countryName: string, dateStringOption = 'Today'): Match {
  const homeRaw = event.T1?.[0];
  const awayRaw = event.T2?.[0];

  const homeName = homeRaw?.Nm || 'Home Team';
  const awayName = awayRaw?.Nm || 'Away Team';
  const id = event.Eid;
  const slug = `${slugify(homeName)}-vs-${slugify(awayName)}-${id}`;

  const homeImg = homeRaw?.Img;
  const awayImg = awayRaw?.Img;

  const homeId = homeRaw?.ID;
  const awayId = awayRaw?.ID;

  let homeLsBadge: string | null = null;
  if (homeImg) {
    homeLsBadge = `https://static.livescore.com/v2/images/teams/large/${homeImg}`;
  } else if (homeId) {
    homeLsBadge = `https://static.livescore.com/v2/images/teams/large/t${homeId}.png`;
  }

  let awayLsBadge: string | null = null;
  if (awayImg) {
    awayLsBadge = `https://static.livescore.com/v2/images/teams/large/${awayImg}`;
  } else if (awayId) {
    awayLsBadge = `https://static.livescore.com/v2/images/teams/large/t${awayId}.png`;
  }

  const kickoffTime = formatEsTime(event.Esd);
  const eps = event.Eps || 'NS';
  const isFinished = ['FT', 'AET', 'AP', 'FT_PEN', 'POSTP', 'CANCL', 'Postp.', 'Canc.', 'Postp', 'Canc', 'Abd', 'Abd.'].includes(eps);
  const isLive = ['1H', 'HT', '2H', 'ET', 'Pen', 'LIVE'].includes(eps) || (!isFinished && !['NS', 'Postp', 'Canc', 'Postp.', 'Canc.', 'POSTP', 'CANCL', 'Abd', 'Abd.'].includes(eps));
  
  let status: 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED' = 'UPCOMING';
  if (isLive) {
    status = 'LIVE';
  } else if (isFinished || dateStringOption === 'Yesterday') {
    status = 'FINISHED';
  } else if (dateStringOption === 'Today') {
    status = 'TODAY';
  } else {
    status = 'UPCOMING';
  }

  // Server-side reconciliation: if kickoff has passed but upstream eps is
  // still NS (not started), optimistically bump to LIVE so tab bucketing
  // is correct on initial render. Will be corrected on next SWR poll.
  if (status !== 'LIVE' && status !== 'FINISHED' && eps === 'NS' && event.Esd) {
    const esdStr = String(event.Esd);
    if (esdStr.length >= 12) {
      const yyyy = parseInt(esdStr.slice(0, 4), 10);
      const mm = parseInt(esdStr.slice(4, 6), 10) - 1;
      const dd = parseInt(esdStr.slice(6, 8), 10);
      const hh = parseInt(esdStr.slice(8, 10), 10);
      const min = parseInt(esdStr.slice(10, 12), 10);
      const kickoff = new Date(yyyy, mm, dd, hh, min, 0);
      if (!isNaN(kickoff.getTime()) && Date.now() > kickoff.getTime()) {
        status = 'LIVE';
      }
    }
  }

  // Guess category
  let category: 'ZPSL' | 'INTERNATIONAL' | 'AFRICA' = 'INTERNATIONAL';
  const compLower = (stageName + ' ' + (countryName || '')).toLowerCase();
  if (compLower.includes('zimbabwe') || compLower.includes('zpsl') || compLower.includes('premier soccer league')) {
    category = 'ZPSL';
  } else if (compLower.includes('africa') || compLower.includes('caf') || compLower.includes('cosafa')) {
    category = 'AFRICA';
  }

  return {
    id,
    slug,
    teams: {
      home: {
        name: homeName,
        code: homeName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'T'),
        logoColor: getTeamColor(homeName),
        lsBadge: homeLsBadge,
      },
      away: {
        name: awayName,
        code: awayName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'T'),
        logoColor: getTeamColor(awayName),
        lsBadge: awayLsBadge,
      }
    },
    score: {
      home: event.Tr1 && event.Tr1 !== '' ? parseInt(event.Tr1, 10) : 0,
      away: event.Tr2 && event.Tr2 !== '' ? parseInt(event.Tr2, 10) : 0,
    },
    status,
    minute: event.Ela && !isNaN(parseInt(event.Ela, 10)) ? parseInt(event.Ela, 10) : undefined,
    eps: event.Eps,
    competition: (() => {
      const comp = stageName || 'Football League';
      const cLower = comp.toLowerCase().trim();
      const country = (countryName || '').trim();
      const countryLower = country.toLowerCase();

      // If it is a generic Premier League stage name, check the country to give it a descriptive name
      if (cLower === 'premier league' || cLower === 'england: premier league' || cLower === 'england premier league') {
        if (!country || countryLower.includes('england')) {
          return 'English Premier League';
        }
        if (countryLower === 'south africa') return 'South African Premier League';
        if (countryLower.includes('zimbabwe')) return 'Zimbabwe Premier Soccer League';
        if (countryLower === 'egypt') return 'Egyptian Premier League';
        if (countryLower === 'russia') return 'Russian Premier League';
        if (countryLower === 'scotland') return 'Scottish Premier League';
        if (countryLower === 'ukraine') return 'Ukrainian Premier League';
        return `${country} Premier League`;
      }
      return comp;
    })(),
    kickoffTime,
    dateString: dateStringOption,
    esd: event.Esd ? String(event.Esd) : undefined,
    category,
    venue: event.Vnm || 'Stadium',
    spectators: '24,500',
    servers: [] // Powered dynamically by match buttons API!
  };
}
