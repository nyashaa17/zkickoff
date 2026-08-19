// Real-time Bzzoiro standings proxy API — delegates to lib/standings-service.ts
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { apiRateLimiter } from '@/lib/rate-limit';
import { LEAGUES_REGISTRY } from '@/lib/leagues-config';
import { fetchLeagueStandings } from '@/lib/standings-service';

/**
 * Maps a competition query parameter (from the homepage activeCategory state)
 * to a league slug from LEAGUES_REGISTRY. Returns null for "ALL" — the caller
 * should hide the standings card rather than silently substituting one league.
 */
function resolveSlug(competition: string): string | null {
  const comp = competition.toLowerCase().trim();

  // "ALL" means no single league is selected — don't show any standings
  if (comp === 'all') return null;

  // Try to match against known league slugs, names, shortNames
  for (const league of LEAGUES_REGISTRY) {
    if (
      comp === league.slug ||
      comp === league.name.toLowerCase() ||
      comp === league.shortName.toLowerCase() ||
      comp === league.country.toLowerCase()
    ) {
      return league.slug;
    }
  }

  // Fuzzy fallbacks for common keyword forms used by the homepage category filter
  const keywordMap: Record<string, string> = {
    'laliga': 'la-liga',
    'la liga': 'la-liga',
    'spain': 'la-liga',
    'primera': 'la-liga',
    'serie a': 'serie-a',
    'italy': 'serie-a',
    'bundesliga': 'bundesliga',
    'germany': 'bundesliga',
    'ligue 1': 'ligue-1',
    'france': 'ligue-1',
    'champions league': 'champions-league',
    'uefa': 'champions-league',
    'europa league': 'europa-league',
    'saudi': 'saudi-pro-league',
    'pro league': 'saudi-pro-league',
    'mls': 'mls',
    'major league soccer': 'mls',
    'j1': 'mls',
    'j-league': 'mls',
    'j.league': 'mls',
    'japan': 'mls',
    'zimbabwe': 'premier-league',
    'zpsl': 'premier-league',
    'premier soccer league': 'premier-league',
    'championship': 'championship',
    'premier league': 'premier-league',
    'english premier league': 'premier-league',
  };

  for (const [keyword, slug] of Object.entries(keywordMap)) {
    if (comp.includes(keyword)) {
      return slug;
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!apiRateLimiter(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const competitionParam = searchParams.get('competition') || 'ALL';

    const slug = resolveSlug(competitionParam);

    // When activeCategory is "ALL", return an explicit empty state
    // so the client can hide the standings card entirely
    if (!slug) {
      return NextResponse.json({
        noLeagueSelected: true,
        standings: [],
      });
    }

    // Delegate to the canonical standings service
    const result = await fetchLeagueStandings(slug);

    if (!result || result.error) {
      // Return explicit error state — never fabricated data
      return NextResponse.json({
        error: true,
        message: result?.error || 'Unable to load standings',
        standings: [],
      });
    }

    // Transform to the shape the homepage sidebar expects
    const rawList = result.standings || [];
    const maxEntries = Math.min(rawList.length, 20);
    const itemsToShow = rawList.slice(0, maxEntries);

    const standings = itemsToShow.map((item) => {
      // Safely split form text (e.g. "WDWLW" -> ["W", "D", "W", "L", "W"])
      let parsedForm: string[] = [];
      if (item.form && typeof item.form === 'string') {
        parsedForm = item.form.trim().split('').slice(0, 5);
      } else if (Array.isArray(item.form)) {
        parsedForm = item.form.slice(0, 5);
      }

      return {
        rank: item.position || 0,
        team: item.team_name || 'Unknown',
        played: item.played || 0,
        points: item.pts || 0,
        form: parsedForm.length > 0 ? parsedForm : [],
        logoUrl: item.team_id ? `https://sports.bzzoiro.com/img/team/${item.team_id}` : null,
      };
    });

    return NextResponse.json(standings);
  } catch (error: any) {
    console.error('Standings Proxy Error:', error);

    // Return explicit error — no fake mock data
    return NextResponse.json({
      error: true,
      message: 'Unable to load standings',
      standings: [],
    });
  }
}
