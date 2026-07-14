import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { 
  getFormattedDateString, 
  parseRawEventToMatch, 
  LivescoreResponseRaw 
} from '@/lib/totalsports-api';
import { Match, mockMatches } from '@/lib/matches-data';
import { getTeamLogoUrl, getLeagueLogoUrl } from '@/lib/bzzoiro-api';

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
      // Parallel fetch for Yesterday, Today, and Tomorrow to fully populate all tabs
      const yesterdayStr = getFormattedDateString(-1);
      const todayStr = getFormattedDateString(0);
      const tomorrowStr = getFormattedDateString(1);

      const [yesterdayRes, todayRes, tomorrowRes] = await Promise.all([
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${yesterdayStr}`, { next: { revalidate: 30 } }).catch(() => null),
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${todayStr}`, { next: { revalidate: 15 } }).catch(() => null),
        fetch(`https://king.totalsportslive.co.zw/api/livescore?date=${tomorrowStr}`, { next: { revalidate: 60 } }).catch(() => null)
      ]);

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

      const [yesterdayMatches, todayMatches, tomorrowMatches] = await Promise.all([
        processResponse(yesterdayRes, 'Yesterday'),
        processResponse(todayRes, 'Today'),
        processResponse(tomorrowRes, 'Tomorrow')
      ]);

      const rawMatches = [...yesterdayMatches, ...todayMatches, ...tomorrowMatches];
      const matches = await enrichMatchesWithLogos(rawMatches);

      return NextResponse.json({ matches });
    }
  } catch (error: any) {
    console.error('Livescore Route Error (graceful mock fallback applied):', error);
    try {
      const fallbackMatches = await enrichMatchesWithLogos(mockMatches);
      return NextResponse.json({ 
        error: 'Failed to retrieve real-time score feeds, using offline cached data',
        message: error.message,
        matches: fallbackMatches 
      });
    } catch (fallbackErr: any) {
      console.error('Livescore Route Error fallback failed:', fallbackErr);
      return NextResponse.json({ 
        error: 'Failed to retrieve real-time score feeds',
        message: error.message,
        matches: mockMatches 
      });
    }
  }
}
