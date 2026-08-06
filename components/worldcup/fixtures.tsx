import React from 'react';
import { Info, Calendar as CalendarIcon, Clock, Compass } from 'lucide-react';
import { getWorldCupLeagueId, getTeamFlagUrl } from './helpers';

async function getWCFixtures() {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) return { error: 'API Key missing.' };

  const leagueId = await getWorldCupLeagueId();
  if (!leagueId) return { error: 'Could not resolve World Cup League ID.' };

  try {
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/events/?league_id=${leagueId}&limit=100`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 60 } 
    });
    
    if (!res.ok) {
      return { error: `API responded with status: ${res.status}` };
    }
    
    return res.json();
  } catch (error) {
    console.error('Failed to fetch world cup fixtures:', error);
    return { error: 'Network error occurred while fetching fixtures.' };
  }
}

export async function WorldCupFixtures() {
  const data = await getWCFixtures();

  if (data.error) {
    return (
      <div className="bg-red-50 text-red-800 p-6 rounded-2xl flex items-start flex-col gap-3 border border-red-200 font-medium">
         <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-red-600" />
            <h3 className="font-bold">Cannot Load Fixtures</h3>
         </div>
         <p>{data.error}</p>
      </div>
    );
  }

  const rawEvents = data.results || data || [];

  if (!rawEvents || rawEvents.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-100 border-dashed">
        No fixtures available at this time.
      </div>
    );
  }

  // Sort events in ascending chronological order of dates
  const events = [...rawEvents].sort((a: any, b: any) => {
    const dateA = a.event_date ? new Date(a.event_date).getTime() : 0;
    const dateB = b.event_date ? new Date(b.event_date).getTime() : 0;
    return dateA - dateB;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.isArray(events) && events.map((match: any, i: number) => {
        const homeTeam = match.home_team || 'TBD';
        const awayTeam = match.away_team || 'TBD';
        const homeScore = match.home_score;
        const awayScore = match.away_score;
        
        const homeFlagUrl = getTeamFlagUrl(homeTeam);
        const awayFlagUrl = getTeamFlagUrl(awayTeam);
        
        const date = match.event_date ? new Date(match.event_date) : null;
        const timeStr = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD';
        const dateStr = date ? date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
        
        const roundName = match.round_name;
        const groupName = match.group_name;
        const status = match.status;

        const stageInfo = [roundName, groupName].filter(Boolean).join(' • ');

        // Check if the match has started or finished
        const isLive = ['inprogress', '1st_half', 'halftime', '2nd_half', 'aet', 'penalties'].includes(status);
        const isFinished = status === 'finished' || status === 'FT';

        return (
          <div key={match.id || i} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
             <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-100 flex justify-between items-center text-xs font-bold text-neutral-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {dateStr}
                </div>
                <div className="flex items-center gap-2">
                  {isLive ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold lowercase animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      live {match.current_minute ? `${match.current_minute}'` : ''}
                    </span>
                  ) : isFinished ? (
                    <span className="text-neutral-400">finished</span>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      {timeStr}
                    </>
                  )}
                </div>
             </div>
             
             <div className="p-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <div className="flex items-center justify-end gap-2 text-sm md:text-base font-bold text-neutral-900 w-[38%] truncate" title={homeTeam}>
                    <span className="truncate">{homeTeam}</span>
                    {homeFlagUrl ? (
                      <img 
                        src={homeFlagUrl} 
                        alt="" 
                        className="w-5.5 h-4 object-cover rounded-sm shadow-xs border border-neutral-100 flex-shrink-0" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-5.5 h-4 bg-neutral-100 rounded-sm flex items-center justify-center border border-neutral-200 text-[8px] text-neutral-400 font-bold uppercase flex-shrink-0 select-none">
                        {homeTeam.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  
                  <div className="px-3 py-1 bg-neutral-100 rounded-xl font-mono text-sm md:text-base font-black flex gap-2 text-neutral-800 flex-shrink-0">
                    <span>{homeScore !== undefined && homeScore !== null ? homeScore : '-'}</span>
                    <span className="text-neutral-400">:</span>
                    <span>{awayScore !== undefined && awayScore !== null ? awayScore : '-'}</span>
                  </div>
                  
                  <div className="flex items-center justify-start gap-2 text-sm md:text-base font-bold text-neutral-900 w-[38%] truncate" title={awayTeam}>
                    {awayFlagUrl ? (
                      <img 
                        src={awayFlagUrl} 
                        alt="" 
                        className="w-5.5 h-4 object-cover rounded-sm shadow-xs border border-neutral-100 flex-shrink-0" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-5.5 h-4 bg-neutral-100 rounded-sm flex items-center justify-center border border-neutral-200 text-[8px] text-neutral-400 font-bold uppercase flex-shrink-0 select-none">
                        {awayTeam.slice(0, 2)}
                      </div>
                    )}
                    <span className="truncate">{awayTeam}</span>
                  </div>
                </div>
                
                {stageInfo && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex items-center justify-center gap-2 text-xs text-neutral-500 font-bold uppercase tracking-wider dark:text-neutral-400">
                    <Compass className="w-4 h-4 text-neutral-400" />
                    <span>{stageInfo}</span>
                  </div>
                )}
             </div>
          </div>
        );
      })}
    </div>
  );
}
