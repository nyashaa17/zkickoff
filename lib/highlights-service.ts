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
      highlights,
      total,
      hasMore: offset + limit < total,
    };
  } catch (err) {
    console.error('[highlights] Error fetching recent highlights:', err);
    return { highlights: [], total: 0, hasMore: false };
  }
}
