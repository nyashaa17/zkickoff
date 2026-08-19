import { NextRequest, NextResponse } from 'next/server';
import { getRecentHighlights } from '@/lib/highlights-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    const data = await getRecentHighlights(limit, offset);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[highlights] API route error:', err);
    return NextResponse.json({ highlights: [], total: 0, hasMore: false });
  }
}
