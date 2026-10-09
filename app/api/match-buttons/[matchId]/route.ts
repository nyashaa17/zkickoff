import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

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
    const res = await fetch(`https://app.totalsportss.online/match-buttons/${encodeURIComponent(matchId)}`, {
      next: { revalidate: 15 } // revalidate every 15s for streams
    });

    if (!res.ok) {
      // 404 or upstream error: never render 404 HTML as button content
      // Return empty server list without fabricated fallback streams
      return NextResponse.json({
        matchId,
        servers: [],
        rawHtml: ''
      });
    }

    const html = await res.text();

    // Check if match state indicates buttons are unavailable (e.g. scheduled or finished)
    const stateMatch = html.match(/data-match-state=["']([^"']+)["']/i);
    if (stateMatch) {
      try {
        const decodedState = stateMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        const parsedState = JSON.parse(decodedState);
        if (parsedState.available === false) {
          return NextResponse.json({
            matchId,
            servers: [],
            rawHtml: ''
          });
        }
      } catch (e) {
        // Fall through to link parsing
      }
    }

    // Extract page title from h3 tag or .match-title as a robust default stream fixture parameter
    let pageTitleFixture = '';
    const h3Match = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const titleMatch = html.match(/<div class=["']match-title["']>([\s\S]*?)<\/div>/i);
    if (h3Match) {
      pageTitleFixture = h3Match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    } else if (titleMatch) {
      pageTitleFixture = titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
        label = label.replace(/\s+/g, ' ');
      }

      // Filter out links that are just shares or scripts
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

    return NextResponse.json({
      matchId,
      servers,
      rawHtml: servers.length > 0 ? html : ''
    });
  } catch (error: any) {
    console.error('Match Buttons Proxy Error:', error?.message || error);
    
    return NextResponse.json({
      matchId,
      servers: [],
      rawHtml: ''
    });
  }
}
