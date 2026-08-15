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
  const fetchWindow = searchParams.get('window') === 'true' || dateParam === 'all';

  try {
    if (!fetchWindow) {
      // Single-date fetch (defaults to Today for fast initial payload & mobile bundle optimization)
      const targetDate = (!dateParam || dateParam === 'today') ? getFormattedDateString(0) : dateParam;
      const isToday = targetDate === getFormattedDateString(0);
      const revalidateSeconds = isToday ? 15 : 300;

      const res = await fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${targetDate}`, {
        next: { revalidate: revalidateSeconds }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch from backend score provider: ${res.status}`);
      }
      const data: LivescoreResponseRaw = await res.json();
      const rawMatches: Match[] = [];
      
      let dateLabel = isToday ? 'Today' : 'Upcoming';
      if (targetDate && targetDate.length === 8) {
        const yyyy = targetDate.slice(0, 4);
        const mm = targetDate.slice(4, 6);
        const dd = targetDate.slice(6, 8);
        dateLabel = isToday ? 'Today' : `${dd}/${mm}/${yyyy}`;
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
      return NextResponse.json(
        { matches },
        {
          headers: {
            'Cache-Control': isToday
              ? 'public, s-maxage=15, stale-while-revalidate=30'
              : 'public, s-maxage=300, stale-while-revalidate=600',
          },
        }
      );
    } else {
      // Extended multi-day window fetch (Yesterday, Today, and next 6 days) when explicitly requested
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

      return NextResponse.json(
        { matches },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
          },
        }
      );
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
