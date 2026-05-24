import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  
  // Extract custom home and away names if passed as query params to build correct fallbacks
  const { searchParams } = new URL(req.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');
  const teamFallbackFixture = home && away ? `${home} vs ${away}` : null;

  try {
    const res = await fetch(`https://app.totalsportss.online/match-buttons/${matchId}`, {
      next: { revalidate: 15 } // revalidate every 15s for streams
    });

    if (!res.ok) {
      // Clean fallback handling for 404 or other non-ok status codes, avoiding scary error throws
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

      return NextResponse.json({
        matchId,
        servers: fallbackServers,
        rawHtml: `<div class="p-4 text-center text-xs text-neutral-400">Stream links rendering via backup sync.</div>`
      });
    }

    const html = await res.text();

    // Extract page title from h3 tag as a robust default stream fixture parameter
    let pageTitleFixture = '';
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match) {
      pageTitleFixture = h3Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    const fallbackFixture = pageTitleFixture || teamFallbackFixture || matchId;

    // Extract links from HTML
    const servers: { id: string; name: string; embedUrl: string }[] = [];
    
    // Regular expression to extract tags like <a ... href="url">Label</a>
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 1;

    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      let label = match[2].replace(/<[^>]*>/g, '').trim(); // Strip tags from label
      
      if (!label) {
        label = `Stream Feed ${count}`;
      } else {
        // Beautify labels
        label = label.replace(/\s+/g, ' ');
      }

      // Filter out links that are just shares or scripts
      if (url.startsWith('http') && !url.includes('facebook.com') && !url.includes('twitter.com') && !url.includes('whatsapp://')) {
        // Try to extract fixture and stream from the url if it is a livestream link
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
          // Fallback parsing query params with regex for non-standard relative or malformed URLs
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

    // Fallback: if no valid servers could be parsed but we received raw HTML, 
    // maybe we can extract raw URL strings from any src or href
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

    // Ultimate fallback: if still empty, create default iframe streams from the API or responsive domain
    if (servers.length === 0) {
      servers.push({
        id: `srv-fallback-1`,
        name: `TotalSports Official Feed (Direct HD)`,
        embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackFixture)}&stream=1`
      });
    }

    return NextResponse.json({
      matchId,
      servers,
      rawHtml: html
    });
  } catch (error: any) {
    console.error('Match Buttons Proxy Error:', error);
    
    const fallbackFixture = teamFallbackFixture || matchId;
    
    // Default fallback list in case of network outages so the detail page never crashes!
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

    return NextResponse.json({
      matchId,
      servers: fallbackServers,
      rawHtml: `<div class="p-4 text-center text-xs text-neutral-400">Stream links temporarily rendering via primary mirror.</div>`,
      error: error.message
    });
  }
}
