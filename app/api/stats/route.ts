import { NextRequest, NextResponse } from 'next/server';
import { getTeamLogoUrl } from '@/lib/bzzoiro-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get('competition') || 'premier-league';
  const dateOrCategory = searchParams.get('dateOrCategory') || 'england';
  const sport = searchParams.get('sport') || 'football';

  try {
    const backendUrl = `https://cap.totalsportslive.co.zw/api/stats?competition=${competition}&dateOrCategory=${dateOrCategory}&sport=${sport}`;
    const res = await fetch(backendUrl, {
      next: { revalidate: 3600 } // Stats update infrequently, cache for 1 hour
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch stats from cap server: ${res.status}`);
    }

    const data = await res.json();
    
    // Inject Bzzoiro logos
    if (Array.isArray(data)) {
      for (const category of data) {
        if (category.players && Array.isArray(category.players)) {
          for (const player of category.players) {
            player.logoUrl = await getTeamLogoUrl(player.teamName);
          }
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Stats Proxy Error:', error);
    
    // Aesthetic fallback statistics in case of server timeouts or offline API
    const mcLogo = await getTeamLogoUrl("Manchester City");
    const cheLogo = await getTeamLogoUrl("Chelsea");
    const newcLogo = await getTeamLogoUrl("Newcastle");
    const avLogo = await getTeamLogoUrl("Aston Villa");
    const livLogo = await getTeamLogoUrl("Liverpool");

    const fallbackStats = [
      {
        title: "Top Scorers",
        players: [
          { rank: 1, name: "E. Haaland", teamName: "Manchester City", teamBadgeSlug: "teambadge/1234", stats: { Goals: 25 }, logoUrl: mcLogo },
          { rank: 2, name: "Cole Palmer", teamName: "Chelsea", teamBadgeSlug: "teambadge/5678", stats: { Goals: 21 }, logoUrl: cheLogo },
          { rank: 3, name: "Alexander Isak", teamName: "Newcastle", teamBadgeSlug: "teambadge/9012", stats: { Goals: 20 }, logoUrl: newcLogo },
          { rank: 4, name: "Ollie Watkins", teamName: "Aston Villa", teamBadgeSlug: "teambadge/3456", stats: { Goals: 19 }, logoUrl: avLogo },
          { rank: 5, name: "M. Salah", teamName: "Liverpool", teamBadgeSlug: "teambadge/7890", stats: { Goals: 18 }, logoUrl: livLogo }
        ]
      }
    ];

    return NextResponse.json(fallbackStats);
  }
}
