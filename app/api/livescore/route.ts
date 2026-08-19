import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { 
  getFormattedDateString, 
  parseRawEventToMatch, 
  LivescoreResponseRaw 
} from '@/lib/totalsports-api';
import { Match } from '@/lib/matches-data';
import {
  fetchMatchesForDate,
  fetchActiveWindowMatches,
  enrichMatchesWithLogos,
} from '@/lib/server-matches';
import { apiRateLimiter } from '@/lib/rate-limit';

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

      let dateLabel = isToday ? 'Today' : 'Upcoming';
      if (targetDate && targetDate.length === 8) {
        const yyyy = targetDate.slice(0, 4);
        const mm = targetDate.slice(4, 6);
        const dd = targetDate.slice(6, 8);
        dateLabel = isToday ? 'Today' : `${dd}/${mm}/${yyyy}`;
      }

      const revalidateSeconds = isToday ? 15 : 300;
      const rawMatches = await fetchMatchesForDate(targetDate, dateLabel, revalidateSeconds);
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
      // Extended multi-day window fetch — reuses the canonical dayConfigs
      // from lib/server-matches.ts instead of maintaining a duplicate copy
      const rawMatches = await fetchActiveWindowMatches();
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
