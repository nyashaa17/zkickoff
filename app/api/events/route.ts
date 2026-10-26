import { NextResponse } from 'next/server';
import { getPublishedEvents } from '@/lib/supabase/events-query';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await getPublishedEvents();
    return NextResponse.json({ events }, { status: 200 });
  } catch (err: any) {
    console.error('[API /events Error]:', err);
    return NextResponse.json({ events: [], error: 'Failed to fetch events' }, { status: 500 });
  }
}
