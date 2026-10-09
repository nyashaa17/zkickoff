import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getTeamLogoUrl } from '@/lib/bzzoiro-api';

/**
 * Enriches player statistics with team logo URLs from Bzzoiro
 * Only applied when player data is actually available.
 */
async function enrichCategoriesWithLogos(categories: any[]) {
  if (!Array.isArray(categories)) return categories;
  for (const category of categories) {
    if (category.players && Array.isArray(category.players)) {
      for (const player of category.players) {
        if (player.teamName && !player.logoUrl) {
          player.logoUrl = await getTeamLogoUrl(player.teamName);
        }
      }
    }
  }
  return categories;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get('competition') || 'premier-league';
  const dateOrCategory = searchParams.get('dateOrCategory') || 'england';
  const includeDemo = searchParams.get('demo') === 'true';

  // Audit finding:
  // - Legacy stats endpoint "cap.totalsportslive.co.zw/api/stats" is permanently retired.
  // - Counterpart "cap.totalsportslive.xyz/api/stats" is unavailable due to SSL/TLS handshake errors (HTTP 526).
  // - Verified livescore API ("king.totalsportslive.xyz/api/livescore") only provides fixture and match event data.
  // - No verified upstream provider supplies live player statistics.
  // To avoid fabricating live figures or presenting hardcoded numbers as live stats,
  // we return an honest unavailable state (empty array) unless explicitly labelled demo data is requested.

  try {
    if (includeDemo) {
      const demoStats = [
        {
          title: 'Top Scorers (Demo Data)',
          isDemo: true,
          players: [
            { rank: 1, name: 'E. Haaland (Demo)', teamName: 'Manchester City', teamBadgeSlug: 'teambadge/1234', stats: { Goals: 25 } },
            { rank: 2, name: 'Cole Palmer (Demo)', teamName: 'Chelsea', teamBadgeSlug: 'teambadge/5678', stats: { Goals: 21 } },
            { rank: 3, name: 'Alexander Isak (Demo)', teamName: 'Newcastle', teamBadgeSlug: 'teambadge/9012', stats: { Goals: 20 } },
          ],
        },
      ];
      const enrichedDemo = await enrichCategoriesWithLogos(demoStats);
      return NextResponse.json(enrichedDemo);
    }

    // Server-side diagnostic log without exposing any confidential credentials
    console.info(`[Stats API] Stats requested for ${competition}/${dateOrCategory}: upstream service retired; returning unavailable state.`);

    return NextResponse.json([]);
  } catch (error: any) {
    console.error('[Stats API] Error handling stats request:', error?.message || 'Unknown error');
    return NextResponse.json([], { status: 200 });
  }
}
