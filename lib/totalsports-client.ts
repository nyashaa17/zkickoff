import { 
  getFormattedDateString, 
  parseRawEventToMatch, 
  LivescoreResponseRaw 
} from './totalsports-api';
import { Match } from './matches-data';
import { getClientTeamLogo, getClientLeagueLogo } from './bzzoiro-client';

/**
 * Direct unproxied client-side fetch for livescores.
 * This completely bypasses Next/Netlify server-side ip restrictions.
 */
export async function fetchLivescoresDirect(dateParam?: string) {
  if (typeof window === 'undefined') {
    return { matches: [] };
  }
  try {
    const url = dateParam ? `/api/livescore?date=${dateParam}` : '/api/livescore';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch livescores from proxy: ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error('Livescore direct fetch error:', error);
    return { matches: [], error: true, message: "Unable to load matches right now" };
  }
}

/**
 * Direct user-side lookup for player stats
 */
export async function fetchStatsDirect(competition = 'premier-league', dateOrCategory = 'england', sport = 'football') {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const proxyUrl = `/api/stats?competition=${encodeURIComponent(competition)}&dateOrCategory=${encodeURIComponent(dateOrCategory)}&sport=${encodeURIComponent(sport)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats from proxy server: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('Stats fetch error:', error?.message || error);
    // Honest unavailable state: do not fabricate live statistics or present hardcoded figures
    return [];
  }
}

/**
 * Direct unproxied user-side matches stream links configuration parser
 */
export async function fetchMatchButtonsDirect(matchId: string, homeParam?: string | null, awayParam?: string | null) {
  const teamFallbackFixture = homeParam && awayParam ? `${homeParam} vs ${awayParam}` : null;
  try {
    const res = await fetch(`https://app.totalsportss.online/match-buttons/${encodeURIComponent(matchId)}`);
    if (!res.ok) {
      // 404 or other non-ok response: never render 404 HTML as button content
      return {
        matchId,
        servers: [],
        rawHtml: ''
      };
    }
    const html = await res.text();

    // Check if upstream match state indicates buttons are unavailable (e.g. scheduled or finished)
    const stateMatch = html.match(/data-match-state=["']([^"']+)["']/i);
    if (stateMatch) {
      try {
        const decodedState = stateMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        const parsedState = JSON.parse(decodedState);
        if (parsedState.available === false) {
          return {
            matchId,
            servers: [],
            rawHtml: ''
          };
        }
      } catch (e) {
        // Fall through to link parsing
      }
    }

    let pageTitleFixture = '';
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const titleMatch = html.match(/<div class=["']match-title["']>([\s\S]*?)<\/div>/i);
    if (h3Match) {
      pageTitleFixture = h3Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    } else if (titleMatch) {
      pageTitleFixture = titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    const fallbackFixture = pageTitleFixture || teamFallbackFixture || matchId;
    const servers: { id: string; name: string; embedUrl: string }[] = [];

    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 1;

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      let label = match[2].replace(/<[^>]*>/g, '').trim();

      if (!label) {
        label = `Stream Feed ${count}`;
      } else {
        label = label.replace(/\s+/g, ' ');
      }

      if (url.startsWith('http') && !url.includes('facebook.com') && !url.includes('twitter.com') && !url.includes('whatsapp.com') && !url.includes('whatsapp://')) {
        let streamStr = count.toString();
        let fixtureStr = fallbackFixture;

        try {
          const parsedUrl = new URL(url);
          const parsedStream = parsedUrl.searchParams.get("stream");
          if (parsedStream) {
            streamStr = parsedStream;
          }
          const parsedFixture = parsedUrl.searchParams.get("fixture");
          if (parsedFixture) {
            fixtureStr = parsedFixture;
          }
        } catch (e) {
          const fixtureMatch = url.match(/[?&]fixture=([^&]+)/);
          if (fixtureMatch) {
            fixtureStr = decodeURIComponent(fixtureMatch[1]);
          }
          const streamMatch = url.match(/[?&]stream=([^&]+)/);
          if (streamMatch) {
            streamStr = streamMatch[1];
          }
        }

        // Use the new player endpoint https://vicecap.github.io/Play/embed
        servers.push({
          id: `srv-${matchId}-${count}`,
          name: `${label} (HD)`,
          embedUrl: `https://vicecap.github.io/Play/embed?fixture=${encodeURIComponent(fixtureStr)}&stream=${encodeURIComponent(streamStr)}`
        });
        count++;
      }
    }

    return {
      matchId,
      servers,
      rawHtml: servers.length > 0 ? html : ''
    };
  } catch (error: any) {
    console.error('Match buttons direct fetch error:', error?.message || error);
    return {
      matchId,
      servers: [],
      rawHtml: ''
    };
  }
}

/**
 * Direct unproxied user-side lookup for live match commentary
 */
export async function fetchCommentaryDirect(matchId: string) {
  try {
    const res = await fetch(`https://api.totalsportss.online/matches/${matchId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch commentary raw: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Commentary direct fetch error:', error);
    return {
      liveCommentary: [],
      manualCommentary: [],
      error: true
    };
  }
}
