/**
 * Video highlights service — fetches from BSD social endpoint.
 * Filters to video-type entries only. Fails silently (returns []) on any error.
 */

export interface Highlight {
  id: string | number;
  title?: string;
  description?: string;
  url?: string;
  embed_url?: string;
  thumbnail?: string;
  source?: string;
  created_at?: string;
  event_id?: number | string;
  event_name?: string;
  league_name?: string;
}

/**
 * Clubs whose matches should be boosted to the top of the highlights feed.
 * Premier League & Champions League regulars + Zimbabwean / African clubs
 * (core audience).
 */
export const PRIORITY_CLUBS: string[] = [
  // Premier League / English
  'Manchester United', 'Man United', 'Man Utd',
  'Manchester City', 'Man City',
  'Liverpool',
  'Arsenal',
  'Chelsea',
  'Tottenham', 'Spurs',
  'Nottingham Forest', 'Nottingham',
  'Leeds', 'Leeds United',
  'Newcastle', 'Newcastle United',
  'Aston Villa',
  'West Ham',
  'Brighton',
  // European elite
  'Real Madrid',
  'Barcelona',
  'Bayern Munich', 'Bayern München', 'Bayern',
  'PSG', 'Paris Saint-Germain', 'Paris Saint Germain',
  'Juventus',
  'AC Milan', 'Milan',
  'Inter Milan', 'Internazionale',
  'Borussia Dortmund', 'Dortmund',
  'Atletico Madrid', 'Atlético Madrid',
  'Benfica',
  'Porto',
  // Zimbabwean clubs (always boosted — core audience)
  'Dynamos', 'Dynamos FC',
  'Highlanders', 'Highlanders FC',
  'CAPS United',
  'FC Platinum',
  'Chicken Inn',
  'Manica Diamonds',
  'Ngezi Platinum', 'Ngezi Platinum Stars',
  'Bulawayo Chiefs',
  'Herentals',
  'ZPC Kariba',
  'Yadah',
  'Cranborne Bullets',
  'Hwange',
  'Triangle United',
  'Bikita Minerals',
  'Simba Bhora',
  'Telone',
  'Green Fuel',
  // Other African clubs that regularly feature
  'Kaizer Chiefs',
  'Orlando Pirates',
  'Mamelodi Sundowns', 'Sundowns',
  'Al Ahly',
  'Zamalek',
  'TP Mazembe',
  'Esperance',
  'Wydad',
];

/** Lowercase tokens for fast partial matching */
const PRIORITY_TOKENS = PRIORITY_CLUBS.map((c) => c.toLowerCase());

/**
 * Returns true if the text (event_name / title) mentions any priority club.
 * Uses case-insensitive partial (substring) matching.
 */
function isPriorityMatch(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PRIORITY_TOKENS.some((token) => lower.includes(token));
}

/**
 * Deduplicate highlights by event_id, keeping the most recent item per match.
 * Items without an event_id are kept as-is (never deduped).
 */
function dedupeByMatch(highlights: Highlight[]): Highlight[] {
  const seen = new Map<string | number, Highlight>();
  const noEvent: Highlight[] = [];

  for (const hl of highlights) {
    if (!hl.event_id) {
      noEvent.push(hl);
      continue;
    }
    const existing = seen.get(hl.event_id);
    if (!existing) {
      seen.set(hl.event_id, hl);
    } else {
      // Keep the most recent
      const existingDate = existing.created_at ? new Date(existing.created_at).getTime() : 0;
      const currentDate = hl.created_at ? new Date(hl.created_at).getTime() : 0;
      if (currentDate > existingDate) {
        seen.set(hl.event_id, hl);
      }
    }
  }

  return [...seen.values(), ...noEvent];
}

/**
 * Sort highlights: priority-club matches first, then recency descending.
 */
function prioritySort(highlights: Highlight[]): Highlight[] {
  return highlights.slice().sort((a, b) => {
    const aPriority = isPriorityMatch(a.event_name) || isPriorityMatch(a.title) ? 1 : 0;
    const bPriority = isPriorityMatch(b.event_name) || isPriorityMatch(b.title) ? 1 : 0;

    // Priority matches come first
    if (aPriority !== bPriority) return bPriority - aPriority;

    // Within same priority group, sort by recency
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bDate - aDate;
  });
}

const BSD_BASE = 'https://sports.bzzoiro.com/api/v2';

/**
 * Fetch video highlights for a specific event.
 * Returns [] on any error — never throws into page render.
 */
export async function getHighlightsForEvent(eventId: string | number): Promise<Highlight[]> {
  try {
    const apiKey = process.env.BZZOIRO_API_KEY;
    if (!apiKey) return [];

    const url = `${BSD_BASE}/social/?event_id=${eventId}&type=video&limit=10`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
      next: { revalidate: 900 }, // 15 min cache matching BSD cache
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data?.results || [];

    // Filter to video type only (the field may be 'type' or 'media_type')
    return results
      .filter((item: any) => {
        const t = (item.type || item.media_type || '').toLowerCase();
        return t === 'video' || t === 'highlight' || t === 'highlights';
      })
      .map((item: any) => ({
        id: item.id,
        title: item.title || item.text || '',
        description: item.description || item.text || '',
        url: item.url || item.link || item.media_url || '',
        embed_url: item.embed_url || item.embed || '',
        thumbnail: item.thumbnail || item.image || item.thumb || '',
        source: item.source || item.provider || '',
        created_at: item.created_at || item.published_at || item.date || '',
        event_id: item.event_id || eventId,
        event_name: item.event_name || item.match || '',
        league_name: item.league_name || item.competition || '',
      }));
  } catch (err) {
    console.error(`[highlights] Error fetching highlights for event ${eventId}:`, err);
    return [];
  }
}

/**
 * Fetch recent video highlights across all leagues (for the /highlights hub page).
 */
export async function getRecentHighlights(limit = 20, offset = 0): Promise<{
  highlights: Highlight[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const apiKey = process.env.BZZOIRO_API_KEY;
    if (!apiKey) return { highlights: [], total: 0, hasMore: false };

    const url = `${BSD_BASE}/social/?type=video&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
      next: { revalidate: 900 },
    });

    if (!res.ok) return { highlights: [], total: 0, hasMore: false };
    const data = await res.json();
    const results = data?.results || [];
    const total = data?.count || results.length;

    const highlights = results
      .filter((item: any) => {
        const t = (item.type || item.media_type || '').toLowerCase();
        return t === 'video' || t === 'highlight' || t === 'highlights';
      })
      .map((item: any) => ({
        id: item.id,
        title: item.title || item.text || '',
        description: item.description || item.text || '',
        url: item.url || item.link || item.media_url || '',
        embed_url: item.embed_url || item.embed || '',
        thumbnail: item.thumbnail || item.image || item.thumb || '',
        source: item.source || item.provider || '',
        created_at: item.created_at || item.published_at || item.date || '',
        event_id: item.event_id,
        event_name: item.event_name || item.match || '',
        league_name: item.league_name || item.competition || '',
      }));

    return {
      highlights: prioritySort(dedupeByMatch(highlights)),
      total,
      hasMore: offset + limit < total,
    };
  } catch (err) {
    console.error('[highlights] Error fetching recent highlights:', err);
    return { highlights: [], total: 0, hasMore: false };
  }
}
