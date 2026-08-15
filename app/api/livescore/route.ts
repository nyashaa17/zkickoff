import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { 
  getFormattedDateString, 
  parseRawEventToMatch, 
  LivescoreResponseRaw 
} from '@/lib/totalsports-api';
import { Match } from '@/lib/matches-data';
import { getTeamLogoUrl, getLeagueLogoUrl } from '@/lib/bzzoiro-api';
import { apiRateLimiter } from '@/lib/rate-limit';

// Helper to enrich matches with dynamic Bzzoiro Sports Data API logos
async function enrichMatchesWithLogos(matches: Match[]): Promise<Match[]> {
  try {
    return await Promise.all(
      matches.map(async (m) => {
        try {
          const [homeLogo, awayLogo, leagueLogo] = await Promise.all([
            getTeamLogoUrl(m.teams.home.name),
            getTeamLogoUrl(m.teams.away.name),
            getLeagueLogoUrl(m.competition)
          ]);
          return {
            ...m,
            teams: {
              home: { ...m.teams.home, logoUrl: homeLogo, bzzBadge: homeLogo || null },
              away: { ...m.teams.away, logoUrl: awayLogo, bzzBadge: awayLogo || null }
            },
            leagueLogoUrl: leagueLogo
          };
        } catch (err) {
          console.error(`Error enriching match logo for ${m.id}:`, err);
          return m;
        }
      })
    );
  } catch (err) {
    console.error('enrichMatchesWithLogos error:', err);
    return matches;
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!apiRateLimiter(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');

  try {
    if (dateParam) {
      // Fetch specifically for one date
      const res = await fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${dateParam}&t=${Date.now()}`, {
        next: { revalidate: 30 } // Cache for 30s
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch from backend score provider: ${res.status}`);
      }
      const data: LivescoreResponseRaw = await res.json();
      const rawMatches: Match[] = [];
      
      let dateLabel = 'Today';
      if (dateParam && dateParam.length === 8) {
        const yyyy = dateParam.slice(0, 4);
        const mm = dateParam.slice(4, 6);
        const dd = dateParam.slice(6, 8);
        dateLabel = `${dd}/${mm}/${yyyy}`;
      }

      if (data.Stages) {
         data.Stages.forEach((stage) => {
           if (stage.Events) {
             stage.Events.forEach((event) => {
               rawMatches.push(parseRawEventToMatch(event, stage.Snm, stage.Cnm, dateLabel));
             });
           }
         });
      }

      const matches = await enrichMatchesWithLogos(rawMatches);
      return NextResponse.json({ matches });
    } else {
      // Parallel fetch for yesterday, today, and the next 6 days to populate all tabs
      // including the UPCOMING tab with fixtures well before kickoff
      const dayConfigs: { offset: number; label: string; revalidate: number }[] = [
        { offset: -1, label: 'Yesterday', revalidate: 30 },
        { offset: 0, label: 'Today', revalidate: 15 },
        { offset: 1, label: 'Tomorrow', revalidate: 60 },
        { offset: 2, label: getDateLabel(2), revalidate: 300 },
        { offset: 3, label: getDateLabel(3), revalidate: 300 },
        { offset: 4, label: getDateLabel(4), revalidate: 300 },
        { offset: 5, label: getDateLabel(5), revalidate: 300 },
        { offset: 6, label: getDateLabel(6), revalidate: 300 },
      ];

      // Helper to get a readable date label
      function getDateLabel(offset: number): string {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }

      const fetchPromises = dayConfigs.map(({ offset, label, revalidate }) => {
        const dateStr = getFormattedDateString(offset);
        return fetch(
          `https://king.totalsportslive.co.zw/api/livescore?date=${dateStr}`,
          { next: { revalidate } },
        ).catch(() => null);
      });

      const responses = await Promise.all(fetchPromises);

      // Helper to process response
      const processResponse = async (res: Response | null, dateLabel: string) => {
        const list: Match[] = [];
        if (!res || !res.ok) return list;
        try {
          const data: LivescoreResponseRaw = await res.json();
          if (data && data.Stages) {
            data.Stages.forEach((stage) => {
              if (stage.Events) {
                stage.Events.forEach((event) => {
                  list.push(parseRawEventToMatch(event, stage.Snm, stage.Cnm, dateLabel));
                });
              }
            });
          }
        } catch (e) {
          console.error(`Error processing ${dateLabel} scores:`, e);
        }
        return list;
      };

      const allMatchArrays = await Promise.all(
        responses.map((res, i) => processResponse(res, dayConfigs[i].label))
      );

      const rawMatches = allMatchArrays.flat();
      const matches = await enrichMatchesWithLogos(rawMatches);

      return NextResponse.json({ matches });
    }
  } catch (error: any) {
    console.error('Livescore Route Error:', error);
    return NextResponse.json({ 
      error: true,
      message: 'Unable to load matches right now',
      matches: [] 
    }, { status: 500 });
  }
}
