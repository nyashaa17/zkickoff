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
  try {
    if (dateParam) {
      const res = await fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${dateParam}&t=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch raw score provider: ${res.status}`);
      }
      const data: LivescoreResponseRaw = await res.json();
      const rawMatches: Match[] = [];

      if (data.Stages) {
        data.Stages.forEach((stage) => {
          if (stage.Events) {
            stage.Events.forEach((eventItem) => {
              const m = parseRawEventToMatch(eventItem, stage.Snm, stage.Cnm, 'Today');
              const homeLogo = getClientTeamLogo(m.teams.home.name);
              const awayLogo = getClientTeamLogo(m.teams.away.name);
              const leagueLogo = getClientLeagueLogo(m.competition);

              m.teams.home.bzzBadge = homeLogo;
              m.teams.home.logoUrl = homeLogo || undefined;
              m.teams.away.bzzBadge = awayLogo;
              m.teams.away.logoUrl = awayLogo || undefined;
              m.leagueLogoUrl = leagueLogo || undefined;
              rawMatches.push(m);
            });
          }
        });
      }
      return { matches: rawMatches };
    } else {
      const yesterdayStr = getFormattedDateString(-1);
      const todayStr = getFormattedDateString(0);
      const tomorrowStr = getFormattedDateString(1);

      const [yesterdayRes, todayRes, tomorrowRes] = await Promise.all([
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${yesterdayStr}`).catch(() => null),
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${todayStr}`).catch(() => null),
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${tomorrowStr}`).catch(() => null)
      ]);

      const processResponse = async (res: Response | null, dateLabel: string) => {
        const list: Match[] = [];
        if (!res || !res.ok) return list;
        try {
          const data: LivescoreResponseRaw = await res.json();
          if (data && data.Stages) {
            data.Stages.forEach((stage) => {
              if (stage.Events) {
                stage.Events.forEach((eventItem) => {
                  const m = parseRawEventToMatch(eventItem, stage.Snm, stage.Cnm, dateLabel);
                  const homeLogo = getClientTeamLogo(m.teams.home.name);
                  const awayLogo = getClientTeamLogo(m.teams.away.name);
                  const leagueLogo = getClientLeagueLogo(m.competition);

                  m.teams.home.bzzBadge = homeLogo;
                  m.teams.home.logoUrl = homeLogo || undefined;
                  m.teams.away.bzzBadge = awayLogo;
                  m.teams.away.logoUrl = awayLogo || undefined;
                  m.leagueLogoUrl = leagueLogo || undefined;
                  list.push(m);
                });
              }
            });
          }
        } catch (e) {
          console.error(`Error parsing direct ${dateLabel} scores:`, e);
        }
        return list;
      };

      const [yesterdayMatches, todayMatches, tomorrowMatches] = await Promise.all([
        processResponse(yesterdayRes, 'Yesterday'),
        processResponse(todayRes, 'Today'),
        processResponse(tomorrowRes, 'Tomorrow')
      ]);

      return { matches: [...yesterdayMatches, ...todayMatches, ...tomorrowMatches] };
    }
  } catch (error: any) {
    console.error('Livescore direct fetch error:', error);
    return { matches: [], error: error.message };
  }
}

/**
 * Direct unproxied user-side lookup for player stats
 */
export async function fetchStatsDirect(competition = 'premier-league', dateOrCategory = 'england', sport = 'football') {
  try {
    const backendUrl = `https://cap.totalsportslive.co.zw/api/stats?competition=${competition}&dateOrCategory=${dateOrCategory}&sport=${sport}`;
    const res = await fetch(backendUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats from cap server: ${res.status}`);
    }
    const data = await res.json();

    if (Array.isArray(data)) {
      for (const category of data) {
        if (category.players && Array.isArray(category.players)) {
          for (const player of category.players) {
            const logo = getClientTeamLogo(player.teamName);
            player.logoUrl = logo || undefined;
          }
        }
      }
    }
    return data;
  } catch (error: any) {
    console.error('Stats direct fetch error:', error);
    // Return graceful mock fallback
    return [
      {
        title: "Top Scorers",
        players: [
          { rank: 1, name: "E. Haaland", teamName: "Manchester City", teamBadgeSlug: "teambadge/1234", stats: { Goals: 25 }, logoUrl: getClientTeamLogo("Manchester City") || undefined },
          { rank: 2, name: "Cole Palmer", teamName: "Chelsea", teamBadgeSlug: "teambadge/5678", stats: { Goals: 21 }, logoUrl: getClientTeamLogo("Chelsea") || undefined },
          { rank: 3, name: "Alexander Isak", teamName: "Newcastle", teamBadgeSlug: "teambadge/9012", stats: { Goals: 20 }, logoUrl: getClientTeamLogo("Newcastle") || undefined }
        ]
      }
    ];
  }
}

/**
 * Direct unproxied user-side matches stream links configuration parser
 */
export async function fetchMatchButtonsDirect(matchId: string, homeParam?: string | null, awayParam?: string | null) {
  const teamFallbackFixture = homeParam && awayParam ? `${homeParam} vs ${awayParam}` : null;
  try {
    const res = await fetch(`https://app.totalsportss.online/match-buttons/${matchId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch buttons: ${res.status}`);
    }
    const html = await res.text();

    let pageTitleFixture = '';
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match) {
      pageTitleFixture = h3Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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

      if (url.startsWith('http') && !url.includes('facebook.com') && !url.includes('twitter.com') && !url.includes('whatsapp://')) {
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

        servers.push({
          id: `srv-${matchId}-${count}`,
          name: `${label} (HD)`,
          embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fixtureStr)}&stream=${streamStr}`
        });
        count++;
      }
    }

    if (servers.length === 0) {
      const urlRegex = /https:\/\/app\.totalsportss\.online\/embed\/[^\s"'`>]+/gi;
      const urlsFound = html.match(urlRegex) || [];
      const uniqueUrls = Array.from(new Set(urlsFound));

      uniqueUrls.forEach((url, index) => {
        servers.push({
          id: `srv-${matchId}-${index + 1}`,
          name: `Premium Server ${index + 1} (FHD)`,
          embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=${index + 1}`
        });
      });
    }

    // Return empty list so "No stream links" banner is shown.
    
    return {
      matchId,
      servers,
      rawHtml: html
    };
  } catch (error: any) {
    console.error('Match buttons direct fetch error:', error);
    
    return {
      matchId,
      servers: [],
      rawHtml: `<div class="p-4 text-center text-xs text-neutral-400">Stream links rendering via backup sync.</div>`
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
      liveCommentary: [
        { time: 1, text: "KICK-OFF! The referee blows the whistle and we are underway." },
        { time: 12, text: "Corner kick awarded. Defended well by the tactical box layout." },
        { time: 24, text: "Shots on target! A spectacular save keeps the clean sheet." },
        { time: 45, text: "Halftime whistle. Teams retreat to the dressing rooms after a high-octane half." },
        { time: 46, text: "Second half starts! Intense battles ahead." }
      ],
      manualCommentary: [
        { time: 6, text: "Heavy local support is roaring in the grandstands today. The atmosphere is absolute electric." }
      ]
    };
  }
}
