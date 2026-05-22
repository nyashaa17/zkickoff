import { NextRequest, NextResponse } from 'next/server';
import { 
  getFormattedDateString, 
  parseRawEventToMatch, 
  LivescoreResponseRaw 
} from '@/lib/totalsports-api';
import { Match } from '@/lib/matches-data';

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
      const matches: Match[] = [];
      
      if (data.Stages) {
        data.Stages.forEach((stage) => {
          if (stage.Events) {
            stage.Events.forEach((event) => {
              matches.push(parseRawEventToMatch(event, stage.Snm, stage.Cnm, 'Today'));
            });
          }
        });
      }
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

      const matches = [...yesterdayMatches, ...todayMatches, ...tomorrowMatches];

      return NextResponse.json({ matches });
    }
  } catch (error: any) {
    console.error('Livescore Route Error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve real-time score feeds',
      message: error.message,
      matches: [] 
    }, { status: 500 });
  }
}
