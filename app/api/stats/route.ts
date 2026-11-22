import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const competition = searchParams.get('competition') || 'premier-league';
  const dateOrCategory = searchParams.get('dateOrCategory') || 'england';

  // Legacy stats endpoints (cap.totalsportslive.*) are retired/unavailable.
  // Return an honest empty array so clients display a genuine unavailable state
  // without fabricated or demo player statistics.
  console.info(
    `[Stats API] Stats requested for ${competition}/${dateOrCategory}: returning honest unavailable state.`
  );

  return NextResponse.json([], { status: 200 });
}
