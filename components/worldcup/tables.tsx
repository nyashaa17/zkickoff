import React from 'react';
import { Info, Target } from 'lucide-react';
import { getWorldCupLeagueId, getTeamFlagUrl } from './helpers';

async function getWCTables() {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) return { error: 'API Key missing.' };

  const leagueId = await getWorldCupLeagueId();
  if (!leagueId) return { error: 'Could not resolve World Cup League ID.' };

  try {
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/${leagueId}/standings/`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 3600 } 
    });
    
    if (!res.ok) {
      return { error: `API responded with status: ${res.status}` };
    }
    
    return res.json();
  } catch (error) {
    console.error('Failed to fetch world cup tables:', error);
    return { error: 'Network error occurred while fetching groups tables.' };
  }
}

export async function WorldCupTables() {
  const data = await getWCTables();

  if (data.error) {
    return (
      <div className="bg-red-50 text-red-800 p-6 rounded-2xl flex items-start flex-col gap-3 border border-red-200 font-medium">
         <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-red-600" />
            <h3 className="font-bold">Cannot Load Groups Tables</h3>
         </div>
         <p>{data.error}</p>
      </div>
    );
  }

  // Handle various potential API shapes for standings
  let standingsList = data.results || data || {};
  
  if (!standingsList || (Array.isArray(standingsList) && standingsList.length === 0) || Object.keys(standingsList).length === 0) {
    return (
      <div className="py-12 text-center text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-100 border-dashed">
        No groups tables available at this time.
      </div>
    );
  }

  // Group the standings if they are flat
  let groups: Record<string, any[]> = {};
  
  if (data.grouped && data.groups) {
    groups = data.groups;
  } else if (data.standings && Array.isArray(data.standings)) {
    // If it is a flat standings list, wrap it in a "League Standings" pseudo-group
    groups = { "Standings": data.standings };
  } else if (Array.isArray(standingsList)) {
    // Determine if it comprises grouped objects, e.g., { group: 'A', rows: [...] }
    if (standingsList[0]?.group && Array.isArray(standingsList[0]?.rows)) {
      standingsList.forEach((g: any) => {
        groups[g.group || g.name] = g.rows || g.standings;
      });
    } else {
      // Flat list
      standingsList.forEach((row: any) => {
        const groupName = row.group_name || row.group || 'Group Stage';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(row);
      });
    }
  } else if (typeof standingsList === 'object' && !data.error) {
     // Safeguard: Only pull properties that are array value lists, and exclude core top-level metadata keys
     Object.keys(standingsList).forEach((key) => {
       const val = standingsList[key];
       if (Array.isArray(val) && !['league_id', 'grouped', 'season', 'standings', 'results', 'error'].includes(key)) {
         groups[key] = val;
       }
     });
  }

  const groupKeys = Object.keys(groups).sort();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {groupKeys.map(groupName => {
        const rows = groups[groupName];
        
        return (
          <div key={groupName} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="bg-neutral-900 px-5 py-3 border-b border-neutral-800 flex justify-between items-center text-sm font-bold text-white uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#009739]" />
                  {groupName}
                </div>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 w-8">#</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-3 py-3 text-center">P</th>
                      <th className="px-3 py-3 text-center">W</th>
                      <th className="px-3 py-3 text-center">D</th>
                      <th className="px-3 py-3 text-center">L</th>
                      <th className="px-3 py-3 text-center">GD</th>
                      <th className="px-4 py-3 text-center font-black text-neutral-900">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {Array.isArray(rows) && rows.map((row: any, i: number) => {
                      const pos = row.position || (i + 1);
                      const teamName = row.team?.name || row.team_name || 'TBD';
                      const played = row.matches_played || row.played || 0;
                      const won = row.wins || row.won || 0;
                      const drawn = row.draws || row.drawn || 0;
                      const lost = row.losses || row.lost || 0;
                      const gd = row.goal_difference || row.gd || 0;
                      const pts = row.points || row.pts || 0;
                      
                      const flagUrl = getTeamFlagUrl(teamName);
                      
                      return (
                        <tr key={row.team?.id || row.team_id || i} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-neutral-500">{pos}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900">
                            <div className="flex items-center gap-2">
                              {flagUrl ? (
                                <img 
                                  src={flagUrl} 
                                  alt={`${teamName} flag`} 
                                  className="w-5.5 h-4 object-cover rounded-sm shadow-xs border border-neutral-200"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-5.5 h-4 bg-neutral-100 rounded-sm flex items-center justify-center border border-neutral-200 text-[8px] text-neutral-400 font-bold uppercase select-none">
                                  {teamName.slice(0, 2)}
                                </div>
                              )}
                              <span className="truncate">{teamName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-neutral-600">{played}</td>
                          <td className="px-3 py-3 text-center text-neutral-600">{won}</td>
                          <td className="px-3 py-3 text-center text-neutral-600">{drawn}</td>
                          <td className="px-3 py-3 text-center text-neutral-600">{lost}</td>
                          <td className="px-3 py-3 text-center text-neutral-600">{gd}</td>
                          <td className="px-4 py-3 text-center font-black text-neutral-900">{pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>
          </div>
        );
      })}
    </div>
  );
}
