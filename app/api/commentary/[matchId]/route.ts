import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { apiRateLimiter } from '@/lib/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!apiRateLimiter(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const res = await fetch(`https://api.totalsportss.online/matches/${matchId}`, {
      next: { revalidate: 15 } // commentary is live, cache for 15s max
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch commentary from game server: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Commentary Proxy Error:', error);
    
    return NextResponse.json({ liveCommentary: [], manualCommentary: [], error: true }, { status: 500 });
  }
}
