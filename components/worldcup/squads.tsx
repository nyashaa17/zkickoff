import React from 'react';
import Link from 'next/link';
import { Flag, User, Info, ArrowLeft } from 'lucide-react';
import { getWorldCupTeamsMap, getTeamFlagUrl, getWorldCupTeams } from './helpers';

async function getTeamSquad(teamId: string) {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    return { error: 'API Key missing. Please configure BZZOIRO_API_KEY environment variable.' };
  }

  try {
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/worldcup/squads/${teamId}/`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 60 } // Cache for 1 minute
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        return { error: 'Invalid API Key. Unauthorized.' };
      }
      return { error: `API responded with status: ${res.status}` };
    }
    
    const data = await res.json();
    return { results: data };
  } catch (error) {
    console.error('Failed to fetch squad for team:', error);
    return { error: 'Network error occurred while fetching squad.' };
  }
}

export async function WorldCupSquads({ page = 1, teamId }: { page?: number; teamId?: string }) {
  if (teamId) {
    const [squadData, allTeams] = await Promise.all([
      getTeamSquad(teamId),
      getWorldCupTeams()
    ]);

    if (squadData.error) {
      return (
        <div className="bg-red-50 text-red-800 p-6 rounded-2xl flex items-start flex-col gap-3 border border-red-200 font-medium">
           <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-red-600" />
              <h3 className="font-bold">Cannot Load Squad</h3>
           </div>
           <p>{squadData.error}</p>
           <Link href="/worldcup?tab=squads" className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-lg transition-colors">
              Back to Teams
           </Link>
        </div>
      );
    }

    const teamIdNum = parseInt(teamId, 10);
    const activeTeam = allTeams.find((t: any) => t.id === teamIdNum);
    const activeTeamName = activeTeam?.name || `Team ID: ${teamId}`;
    const activeTeamFlag = getTeamFlagUrl(activeTeamName);

    const players = Array.isArray(squadData.results?.results) ? squadData.results.results : [];

    // Group players by normalized position
    const positionGroups: Record<string, any[]> = {
      'Goalkeepers': [],
      'Defenders': [],
      'Midfielders': [],
      'Forwards': [],
      'Squad Call-ups': []
    };

    players.forEach((player: any) => {
      const rawPos = (player.position || 'Squad').toUpperCase();
      if (rawPos.startsWith('G')) {
        positionGroups['Goalkeepers'].push(player);
      } else if (rawPos.startsWith('D')) {
        positionGroups['Defenders'].push(player);
      } else if (rawPos.startsWith('M')) {
        positionGroups['Midfielders'].push(player);
      } else if (rawPos.startsWith('F') || rawPos.startsWith('S') || rawPos.startsWith('A')) {
        positionGroups['Forwards'].push(player);
      } else {
        positionGroups['Squad Call-ups'].push(player);
      }
    });

    const hasAnyPlayers = Object.values(positionGroups).some(arr => arr.length > 0);

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        <div className="flex items-center">
          <Link href="/worldcup?tab=squads" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back to Teams
          </Link>
        </div>

        <div className="bg-neutral-900 text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#009739]/15 rounded-full blur-2xl" />
          {activeTeamFlag ? (
            <img src={activeTeamFlag} alt="" className="w-24 h-16 object-cover rounded-xl shadow-lg border border-white/20 relative z-10" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-24 h-16 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 relative z-10">
              <Flag className="w-10 h-10 text-zim-yellow" />
            </div>
          )}
          <div className="relative z-10 text-center md:text-left flex-1">
            <h2 className="text-2xl md:text-3xl font-black font-display tracking-tight mb-2">{activeTeamName} Squad</h2>
            <p className="text-neutral-400 text-sm font-medium">Official announced squad roster for the FIFA 2026 World Cup.</p>
          </div>
        </div>

        {hasAnyPlayers ? (
          <div className="space-y-8">
            {Object.entries(positionGroups).map(([groupName, groupPlayers]) => {
              if (groupPlayers.length === 0) return null;
              return (
                <div key={groupName} className="space-y-4">
                  <h3 className="text-lg font-bold font-display text-neutral-800 border-b border-neutral-150 pb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#009739]"></span>
                    {groupName} <span className="text-xs text-neutral-500 font-mono font-medium">({groupPlayers.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupPlayers.map((player: any, i: number) => {
                      const clubName = player.club || player.club_name || "N/A";
                      const clubCountry = player.club_country;
                      const clubDisplay = clubCountry ? `${clubName} (${clubCountry})` : clubName;

                      return (
                        <div key={player.id || i} className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold font-display text-base text-neutral-900 flex-1 flex items-center gap-2">
                              {player.jersey_number && (
                                <span className="text-xs font-mono font-bold px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded border border-neutral-200 shrink-0">
                                  #{player.jersey_number}
                                </span>
                              )}
                              <span className="truncate">{player.name || "Unknown Player"}</span>
                            </h4>
                            <span className="bg-neutral-50 text-neutral-500 text-[10px] px-2 py-0.5 font-bold rounded-lg ml-2 whitespace-nowrap capitalize border border-neutral-150">
                              {player.status || player.position || "Squad"}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm text-neutral-600">
                             <div className="flex items-center gap-2">
                               <User className="w-4 h-4 text-neutral-400 shrink-0" />
                               <span className="truncate">Club: {clubDisplay}</span>
                             </div>
                             {player.age && (
                               <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                                 <span>Age: {player.age} yrs</span>
                                 {player.date_of_birth && <span className="text-neutral-300">|</span>}
                                 {player.date_of_birth && <span>Born: {player.date_of_birth}</span>}
                               </div>
                             )}
                          </div>
                          
                          {(player.caps !== undefined || player.goals !== undefined) && (
                            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                              <span>Caps: {player.caps ?? '-'}</span>
                              <span>Goals: {player.goals ?? '-'}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-100 border-dashed">
            No players returned for this squad.
          </div>
        )}
      </div>
    );
  }

  // Listing Grid of National Teams
  const [teams, teamsMap] = await Promise.all([
    getWorldCupTeams(),
    getWorldCupTeamsMap()
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-neutral-900 font-display">Select a Nation to View Roster</h2>
        <p className="text-neutral-500 text-sm">Click any national team below to view their active official 2026 FIFA World Cup roster.</p>
      </div>

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {teams.map((team: any) => {
            const flagUrl = getTeamFlagUrl(team.name);
            return (
              <Link 
                key={team.id}
                href={`/worldcup?tab=squads&team_id=${team.id}`}
                className="group flex flex-col items-center justify-center p-5 bg-white border border-neutral-200 rounded-3xl shadow-xs hover:shadow-md hover:border-[#009739] transition-all text-center gap-3 cursor-pointer"
              >
                {flagUrl ? (
                  <img 
                    src={flagUrl} 
                    alt={`${team.name} flag`} 
                    className="w-14 h-9 object-cover rounded-md shadow-xs border border-neutral-100 group-hover:scale-105 transition-transform" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-14 h-9 bg-neutral-100 rounded-md flex items-center justify-center border border-neutral-200">
                    <Flag className="w-5 h-5 text-neutral-400 group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <div className="space-y-0.5">
                  <h3 className="font-bold text-sm text-neutral-800 group-hover:text-[#009739] transition-colors truncate max-w-[130px]" title={team.name}>
                    {team.name}
                  </h3>
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider group-hover:text-[#009739] transition-colors">
                    View Squad
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-100 border-dashed">
          No national teams returned. Ensure API services are fully operational.
        </div>
      )}
    </div>
  );
}
