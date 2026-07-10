import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');
  
  if (!home || !away) {
    return NextResponse.json({ error: 'Missing home or away team' }, { status: 400 });
  }

  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
  }

  const headers = {
    'Authorization': `Token ${apiKey}`,
    'Accept': 'application/json'
  };

  try {
    // 1. Search for the event using home team name
    const eventsRes = await fetch(`https://sports.bzzoiro.com/api/v2/events/?team_name=${encodeURIComponent(home)}&limit=10`, { headers, cache: 'no-store' });
    if (!eventsRes.ok) throw new Error('Failed to fetch events');
    const eventsData = await eventsRes.json();
    
    // Find the event that has both teams
    const homeLower = home.toLowerCase();
    const awayLower = away.toLowerCase();
    
    // First, try exact matches or includes
    let event = eventsData.results?.find((e: any) => 
      (e.home_team.toLowerCase().includes(homeLower) && e.away_team.toLowerCase().includes(awayLower)) ||
      (e.home_team.toLowerCase().includes(awayLower) && e.away_team.toLowerCase().includes(homeLower))
    );
    
    // If not found, just take the first upcoming event for the home team if available, or just the first event
    if (!event && eventsData.results && eventsData.results.length > 0) {
      event = eventsData.results.find((e: any) => e.status !== 'finished') || eventsData.results[0];
    }
    
    if (!event) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    const eventId = event.id;
    
    // 2. Fetch Metadata (Facts) and Venue Details
    const [metaRes, lineupsRes, oddsRes, statsRes, venueRes] = await Promise.all([
      fetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/metadata/`, { headers, cache: 'no-store' }),
      fetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/lineups/`, { headers, cache: 'no-store' }),
      fetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/odds/comparison/`, { headers, cache: 'no-store' }),
      fetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/stats/`, { headers, cache: 'no-store' }),
      event.venue_id 
        ? fetch(`https://sports.bzzoiro.com/api/v2/venues/${event.venue_id}/`, { headers, cache: 'no-store' })
        : Promise.resolve(null)
    ]);
    
    const metadata = metaRes.ok ? await metaRes.json() : null;
    const lineups = lineupsRes.ok ? await lineupsRes.json() : null;
    const odds = oddsRes.ok ? await oddsRes.json() : null;
    const stats = statsRes.ok ? await statsRes.json() : null;
    const venue = venueRes && venueRes.ok ? await venueRes.json() : null;

    if (venue) {
      event.venue = venue;
    }

    return NextResponse.json({
      event,
      metadata,
      lineups,
      odds,
      stats
    });
    
  } catch (err: any) {
    console.error('Bzzoiro Match Preview Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
