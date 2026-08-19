import { NextResponse } from 'next/server';

function normalizeTeamName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateTeamMatchScore(searchName: string, candidateName: string): number {
  const s = normalizeTeamName(searchName);
  const c = normalizeTeamName(candidateName);
  if (!s || !c) return 0;
  if (s === c) return 100;
  if (s.includes(c) || c.includes(s)) return 80;

  const ignoreWords = new Set(['fc', 'cf', 'club', 'de', 'the', 'sc', 'united', 'city', 'town', 'athletic', 'rovers', 'hotspur', 'hotspurs', 'afc']);
  const sWords = s.split(' ').filter(w => w.length > 2 && !ignoreWords.has(w));
  const cWords = c.split(' ').filter(w => w.length > 2 && !ignoreWords.has(w));

  const matched = sWords.filter(w => cWords.includes(w));
  if (matched.length > 0) {
    return 50 + (matched.length * 15);
  }
  return 0;
}

function verifyKickoffAlignment(primaryDateStr?: string | null, candidateEventDateStr?: string): { aligned: boolean; diffHours: number } {
  if (!primaryDateStr || !candidateEventDateStr) return { aligned: true, diffHours: 0 };
  try {
    const candidateDate = new Date(candidateEventDateStr);
    let primaryDate: Date;
    if (/^\d{8}$/.test(primaryDateStr)) {
      const y = primaryDateStr.slice(0, 4);
      const m = primaryDateStr.slice(4, 6);
      const d = primaryDateStr.slice(6, 8);
      primaryDate = new Date(`${y}-${m}-${d}T12:00:00Z`);
    } else {
      primaryDate = new Date(primaryDateStr);
    }

    if (isNaN(primaryDate.getTime()) || isNaN(candidateDate.getTime())) {
      return { aligned: true, diffHours: 0 };
    }

    const diffHours = Math.abs(candidateDate.getTime() - primaryDate.getTime()) / (1000 * 60 * 60);
    // 24h tolerance accommodates UTC vs local offsets while rejecting matches from other weeks
    return { aligned: diffHours <= 24, diffHours };
  } catch {
    return { aligned: true, diffHours: 0 };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get('home');
  const away = searchParams.get('away');
  const dateParam = searchParams.get('date') || searchParams.get('kickoff');
  
  if (!home || !away) {
    return NextResponse.json({ error: 'Missing home or away team' }, { status: 400 });
  }

  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ notFound: true, message: 'API key not configured' }, { status: 200 });
  }

  const headers = {
    'Authorization': `Token ${apiKey}`,
    'Accept': 'application/json'
  };

  try {
    const now = new Date();
    const dateFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let matchedEvent: any = null;
    const searchTerms = [home, away].filter(Boolean);

    // Strategy 1: Search within active fixture window (±7 days) with limit=50
    for (const term of searchTerms) {
      try {
        const url = `https://sports.bzzoiro.com/api/v2/events/?team_name=${encodeURIComponent(term)}&date_from=${dateFrom}&date_to=${dateTo}&limit=50`;
        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.results || data.results.length === 0) continue;

        for (const ev of data.results) {
          const hScore = calculateTeamMatchScore(home, ev.home_team);
          const aScore = calculateTeamMatchScore(away, ev.away_team);
          const revHScore = calculateTeamMatchScore(home, ev.away_team);
          const revAScore = calculateTeamMatchScore(away, ev.home_team);

          const isMatch = (hScore >= 50 && aScore >= 50);
          const isRevMatch = (revHScore >= 50 && revAScore >= 50);

          if (isMatch || isRevMatch) {
            // Kickoff date alignment check
            const verification = verifyKickoffAlignment(dateParam, ev.event_date);
            if (!verification.aligned) {
              console.warn(`[Bzzoiro Audit] Rejected candidate ID ${ev.id} (${ev.home_team} vs ${ev.away_team}): Kickoff mismatch with fixture date "${dateParam}" by ${verification.diffHours.toFixed(1)}h`);
              continue;
            }

            const totalScore = isMatch ? (hScore + aScore) / 2 : (revHScore + revAScore) / 2;
            if (totalScore < 75) {
              console.warn(`[Bzzoiro Audit] Match resolved with moderate confidence (${totalScore}) for "${home}" vs "${away}" -> ID ${ev.id} ("${ev.home_team}" vs "${ev.away_team}")`);
            }

            matchedEvent = ev;
            break;
          }
        }
        if (matchedEvent) break;
      } catch (err) {
        console.error(`[Bzzoiro] Error searching events for ${term}:`, err);
      }
    }

    // Strategy 2: If not found in date window, search wider (limit=50)
    if (!matchedEvent) {
      for (const term of searchTerms) {
        try {
          const url = `https://sports.bzzoiro.com/api/v2/events/?team_name=${encodeURIComponent(term)}&limit=50`;
          const res = await fetch(url, { headers, cache: 'no-store' });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.results || data.results.length === 0) continue;

          for (const ev of data.results) {
            const hScore = calculateTeamMatchScore(home, ev.home_team);
            const aScore = calculateTeamMatchScore(away, ev.away_team);
            const revHScore = calculateTeamMatchScore(home, ev.away_team);
            const revAScore = calculateTeamMatchScore(away, ev.home_team);

            const isMatch = (hScore >= 50 && aScore >= 50);
            const isRevMatch = (revHScore >= 50 && revAScore >= 50);

            if (isMatch || isRevMatch) {
              const verification = verifyKickoffAlignment(dateParam, ev.event_date);
              if (!verification.aligned) {
                console.warn(`[Bzzoiro Audit] Rejected candidate ID ${ev.id} (${ev.home_team} vs ${ev.away_team}) in wider search: Kickoff mismatch with fixture date "${dateParam}"`);
                continue;
              }

              const totalScore = isMatch ? (hScore + aScore) / 2 : (revHScore + revAScore) / 2;
              if (totalScore < 75) {
                console.warn(`[Bzzoiro Audit] Match resolved with moderate confidence (${totalScore}) for "${home}" vs "${away}" -> ID ${ev.id} ("${ev.home_team}" vs "${ev.away_team}")`);
              }

              matchedEvent = ev;
              break;
            }
          }
          if (matchedEvent) break;
        } catch (err) {
          console.error(`[Bzzoiro] Error in wider search for ${term}:`, err);
        }
      }
    }

    // If still no exact match between the two teams, do not assign arbitrary match from 2027
    if (!matchedEvent) {
      return NextResponse.json({ notFound: true, message: 'Match not found in sports data provider' }, { status: 200 });
    }

    const eventId = matchedEvent.id;

    // Helper for independent, resilient fetches
    const safeFetch = async (url: string) => {
      try {
        const r = await fetch(url, { headers, cache: 'no-store' });
        return r.ok ? await r.json() : null;
      } catch (err) {
        console.error(`[Bzzoiro] Failed fetching ${url}:`, err);
        return null;
      }
    };

    // Fetch sub-endpoints in parallel with independent failure isolation
    const [metadata, lineups, odds, stats, incidents, venue, broadcasts, highlights] = await Promise.all([
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/metadata/`),
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/lineups/`),
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/odds/comparison/`),
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/stats/`),
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/incidents/`),
      matchedEvent.venue_id 
        ? safeFetch(`https://sports.bzzoiro.com/api/v2/venues/${matchedEvent.venue_id}/`)
        : Promise.resolve(null),
      safeFetch(`https://sports.bzzoiro.com/api/v2/events/${eventId}/tv-channels/`),
      safeFetch(`https://sports.bzzoiro.com/api/v2/social/?event_id=${eventId}&type=video&limit=5`)
    ]);

    if (venue) {
      matchedEvent.venue = venue;
    }

    // Normalize broadcasts to a flat array of channels
    let tvChannels: any[] = [];
    if (broadcasts) {
      if (Array.isArray(broadcasts)) {
        tvChannels = broadcasts;
      } else if (broadcasts.tv_channels) {
        tvChannels = Array.isArray(broadcasts.tv_channels) ? broadcasts.tv_channels : [];
      } else if (broadcasts.channels) {
        tvChannels = Array.isArray(broadcasts.channels) ? broadcasts.channels : [];
      } else if (broadcasts.results) {
        tvChannels = Array.isArray(broadcasts.results) ? broadcasts.results : [];
      }
    }

    return NextResponse.json({
      event: matchedEvent,
      metadata,
      lineups,
      odds,
      stats,
      incidents: Array.isArray(incidents) ? incidents : incidents?.incidents || incidents?.results || [],
      tvChannels,
      highlights: (() => {
        if (!highlights) return [];
        const results = highlights.results || [];
        return results.filter((item: any) => {
          const t = (item.type || item.media_type || '').toLowerCase();
          return t === 'video' || t === 'highlight' || t === 'highlights';
        });
      })()
    });
    
  } catch (err: any) {
    console.error('Bzzoiro Match Preview Error:', err);
    return NextResponse.json({ notFound: true, error: err.message }, { status: 200 });
  }
}
