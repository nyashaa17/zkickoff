import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Stats Proxy Error:', error);
    
    // Aesthetic fallback statistics in case of server timeouts or offline API
    const fallbackStats = [
      {
        title: "Top Scorers",
        players: [
          { rank: 1, name: "E. Haaland", teamName: "Manchester City", teamBadgeSlug: "teambadge/1234", stats: { Goals: 25 } },
          { rank: 2, name: "Cole Palmer", teamName: "Chelsea", teamBadgeSlug: "teambadge/5678", stats: { Goals: 21 } },
          { rank: 3, name: "Alexander Isak", teamName: "Newcastle", teamBadgeSlug: "teambadge/9012", stats: { Goals: 20 } },
          { rank: 4, name: "Ollie Watkins", teamName: "Aston Villa", teamBadgeSlug: "teambadge/3456", stats: { Goals: 19 } },
          { rank: 5, name: "M. Salah", teamName: "Liverpool", teamBadgeSlug: "teambadge/7890", stats: { Goals: 18 } }
        ]
      }
    ];

    return NextResponse.json(fallbackStats);
  }
}
