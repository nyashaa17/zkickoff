import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  const matchId = event.queryStringParameters?.matchId;
  const home = event.queryStringParameters?.home;
  const away = event.queryStringParameters?.away;
  const teamFallbackFixture = home && away ? `${home} vs ${away}` : null;

  if (!matchId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Missing matchId parameter' })
    };
  }

  try {
    const res = await fetch(`https://app.totalsportss.online/match-buttons/${matchId}`);

    if (!res.ok) {
      const fallbackFixture = teamFallbackFixture || matchId;
      const fallbackServers = [
        {
          id: `srv-fallback-1`,
          name: `Primary Broadcast Feed (1080p)`,
          embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=1`
        },
        {
          id: `srv-fallback-2`,
          name: `Backup Stream Sync (720p)`,
          embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=2`
        }
      ];

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          matchId,
          servers: fallbackServers,
          rawHtml: `<div class="p-4 text-center text-xs text-neutral-400">Stream links rendering via backup sync.</div>`
        })
      };
    }

    const html = await res.text();

    let pageTitleFixture = '';
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match) {
      pageTitleFixture = h3Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    const fallbackFixture = pageTitleFixture || teamFallbackFixture || matchId;
    const servers: { id: string; name: string; embedUrl: string }[] = [];
    
    // Extractor regex
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

    if (servers.length === 0) {
      servers.push({
        id: `srv-fallback-1`,
        name: `TotalSports Official Feed (Direct HD)`,
        embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=1`
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        matchId,
        servers,
        rawHtml: html
      })
    };
  } catch (error: any) {
    console.error('Match Buttons Proxy Error:', error);
    const fallbackFixture = teamFallbackFixture || matchId;
    const fallbackServers = [
      {
        id: `srv-fallback-1`,
        name: `Primary Broadcast Feed (1080p)`,
        embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=1`
      },
      {
        id: `srv-fallback-2`,
        name: `Backup Stream Sync (720p)`,
        embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=2`
      }
    ];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        matchId,
        servers: fallbackServers,
        rawHtml: `<div class="p-4 text-center text-xs text-neutral-400">Stream links temporarily rendering via primary mirror.</div>`,
        error: error.message
      })
    };
  }
};
