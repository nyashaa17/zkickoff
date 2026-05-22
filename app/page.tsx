'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Play, 
  Flame, 
  Calendar, 
  Tv, 
  Sparkles, 
  Search, 
  Clock, 
  TrendingUp, 
  Network, 
  ListOrdered,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match } from '@/lib/matches-data';
import MatchCard from '@/components/match-card';
import AdPlaceholder from '@/components/ad-placeholder';
import { MatchGridSkeleton } from '@/components/skeleton-loader';

interface PlayerStat {
  rank: number;
  name: string;
  teamName: string;
  teamBadgeSlug: string;
  stats: Record<string, string | number>;
}

interface StatCategory {
  title: string;
  players: PlayerStat[];
}

function HomeContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('filter');
  const initialTab = searchParams.get('tab') as 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED' | null;
  
  const [activeTab, setActiveTab] = useState<'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED'>(initialTab || 'LIVE');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'ZPSL' | 'STATS'>('STATS');
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<StatCategory[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // ZPSL Standings mock
  const standings = [
    { rank: 1, team: "Dynamos FC", played: 7, points: 15, form: ["W", "W", "D", "W", "L"] },
    { rank: 2, team: "Highlanders FC", played: 7, points: 14, form: ["D", "W", "W", "L", "W"] },
    { rank: 3, team: "CAPS United", played: 7, points: 14, form: ["W", "D", "W", "D", "D"] },
    { rank: 4, team: "FC Platinum", played: 7, points: 12, form: ["L", "W", "L", "W", "W"] },
    { rank: 5, team: "Manica Diamonds", played: 7, points: 10, form: ["D", "L", "W", "W", "D"] },
    { rank: 6, team: "Chicken Inn FC", played: 7, points: 9, form: ["L", "D", "D", "W", "L"] },
  ];

  // Load real scores from the Livescore API Proxy
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        if (matches.length === 0) {
          setLoading(true);
        }
        const res = await fetch('/api/livescore');
        if (!res.ok) throw new Error('Failed to retrieve live scores');
        const data = await res.json();
        if (active && data && data.matches) {
          setMatches(data.matches);
        }
      } catch (err) {
        console.error('Homepage livescore fetch error:', err);
        // Fallback to mock data if fetch fails due to network/adblocker
        if (active && matches.length === 0) {
          setMatches([
            {
              id: 'mock-1',
              slug: 'dynamos-vs-caps-united-mock-1',
              teams: {
                home: { name: 'Dynamos FC', code: 'DYN', logoColor: '#0056B3' },
                away: { name: 'CAPS United', code: 'CAP', logoColor: '#009739' }
              },
              score: { home: 1, away: 0 },
              status: 'LIVE',
              minute: 34,
              competition: 'Zimbabwe Premier Soccer League',
              kickoffTime: '15:00',
              dateString: 'Today',
              category: 'ZPSL',
              venue: 'Rufaro Stadium',
              spectators: '15,000',
              servers: []
            },
            {
              id: 'mock-2',
              slug: 'highlanders-vs-fc-platinum-mock-2',
              teams: {
                home: { name: 'Highlanders FC', code: 'HIG', logoColor: '#111111' },
                away: { name: 'FC Platinum', code: 'FCP', logoColor: '#007a33' }
              },
              score: { home: 0, away: 0 },
              status: 'TODAY',
              competition: 'Zimbabwe Premier Soccer League',
              kickoffTime: '18:00',
              dateString: 'Today',
              category: 'ZPSL',
              venue: 'Barbourfields Stadium',
              spectators: '12,000',
              servers: []
            }
          ]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    // Setup active poll timer every 30 seconds for livescore ticks
    const interval = setInterval(loadData, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [matches.length]);

  // Load player statistics from cap API proxy
  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        setStatsLoading(true);
        const res = await fetch('/api/stats?competition=premier-league&dateOrCategory=england');
        if (!res.ok) throw new Error('Unresolved stats');
        const data = await res.json();
        if (active && data && Array.isArray(data)) {
          setStats(data);
        }
      } catch (err) {
        console.error('Stats load error:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, []);

  // Sync category filter and tab from URL search params if present
  useEffect(() => {
    if (initialCategory) {
      setTimeout(() => setActiveCategory(initialCategory), 0);
    }
    if (initialTab) {
      setTimeout(() => setActiveTab(initialTab), 0);
    }
  }, [initialCategory, initialTab]);

  const filteredMatches = matches.filter((match) => {
    // 1. Status Filter
    const matchesStatus = match.status === activeTab;
    
    // 2. League Filter
    if (activeCategory === 'ALL') {
      return matchesStatus;
    }
    return matchesStatus && match.competition === activeCategory;
  });

  const liveCount = matches.filter(m => m.status === 'LIVE').length;
  const todayCount = matches.filter(m => m.status === 'TODAY').length;
  const upcomingCount = matches.filter(m => m.status === 'UPCOMING').length;
  const finishedCount = matches.filter(m => m.status === 'FINISHED').length;

  const majorLeagues = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Europa League', 'ZPSL', 'Zimbabwe Premier Soccer League'];
  
  const tabMatches = matches.filter(m => m.status === activeTab);
  const uniqueLeaguesList = Array.from(new Set(tabMatches.map(m => m.competition)));
  
  const sortedLeagues = uniqueLeaguesList.sort((a, b) => {
     const aIsMajor = majorLeagues.some(ml => a.toLowerCase().includes(ml.toLowerCase()));
     const bIsMajor = majorLeagues.some(ml => b.toLowerCase().includes(ml.toLowerCase()));
     if (aIsMajor && !bIsMajor) return -1;
     if (!aIsMajor && bIsMajor) return 1;
     return a.localeCompare(b);
  });
  
  const leagueFilters = ['ALL', ...sortedLeagues];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      
      {/* Hero section */}
      <section id="hero" className="w-full bg-white rounded-3xl p-6 md:p-10 mb-8 md:mb-12 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Visual modern grid overlay background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        {/* Decorative dynamic shape representing Zimbabwe warriors shield flare */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#009739]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-[#D62828]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 max-w-2xl relative z-10 text-center md:text-left">
          <h1 className="font-display font-extrabold text-3xl md:text-5xl tracking-tight text-neutral-950 leading-tight">
            Watch Live Football <br className="hidden md:inline" /> Matches <span className="text-zim-green underline decoration-zim-yellow decoration-3">Free</span>
          </h1>
          <p className="text-neutral-500 font-medium text-sm md:text-base max-w-lg">
            Fast. Reliable. No signup required. Stream your favourite Zimbabwe Premier Soccer League & European action directly from your device.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 pt-2">
            <button 
              onClick={() => {
                setActiveTab('LIVE');
                document.getElementById('matches-feed')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto cursor-pointer px-5 py-3 bg-zim-green hover:bg-opacity-95 text-white font-display text-xs font-semibold rounded-xl shadow-xs hover:shadow-lg hover:shadow-zim-green/10 flex items-center justify-center gap-2 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Watch Live Streams ({liveCount})
            </button>
            <button 
              onClick={() => {
                setActiveTab('TODAY');
                document.getElementById('matches-feed')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto cursor-pointer px-5 py-3 bg-white border border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:border-neutral-300 font-display text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              View Matches Today ({todayCount})
            </button>
          </div>
        </div>

        {/* Brand visual showcase */}
        <div className="hidden md:flex flex-col items-center justify-center bg-neutral-50 border border-neutral-100 p-6 rounded-2xl w-full max-w-[280px] shrink-0 text-center relative z-10 card-glow">
          <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-1">
            NETWORK STATUS
          </p>
          <div className="flex items-center gap-1.5 text-zim-green font-display font-bold text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zim-green"></span>
            </span>
            HD STREAMS ONLINE
          </div>
          <div className="w-full h-[1px] bg-neutral-200 my-4" />
          <p className="text-neutral-500 text-xs leading-relaxed">
            Data compression protocol active to reduce bandwidth usage on mobile bundles.
          </p>
        </div>
      </section>

      {/* Main Grid: Match Feed vs Standings Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left main content feeding area */}
        <div id="matches-feed" className="lg:col-span-2 space-y-6 scroll-mt-20">
          
          {/* Filtering and headings header */}
          <div className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-3">
              <h2 className="font-display font-bold text-xl md:text-2xl text-neutral-950 flex items-center gap-2">
                <Tv className="w-5 h-5 text-zim-green" />
                Leagues
              </h2>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2 max-w-full">
                {leagueFilters.map((league) => (
                  <button
                    key={league}
                    onClick={() => setActiveCategory(league)}
                    className={`shrink-0 cursor-pointer px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-lg font-display tracking-wide transition-all ${
                      activeCategory === league
                        ? 'bg-zim-black text-white shadow-xs'
                        : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    {league}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter tabs: Live | Today | Upcoming | Finished */}
            <div className="flex border-b border-neutral-200/70 p-1 bg-white border border-neutral-200/50 rounded-2xl relative select-none overflow-x-auto scrollbar-thin">
              
              <button
                onClick={() => setActiveTab('LIVE')}
                className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'LIVE'
                    ? 'bg-neutral-50 text-zim-red shadow-xs border border-neutral-200'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zim-red"></span>
                </span>
                LIVE NOW ({liveCount})
              </button>

              <button
                onClick={() => setActiveTab('TODAY')}
                className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'TODAY'
                    ? 'bg-neutral-50 text-zim-green shadow-xs border border-neutral-200'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-zim-yellow" />
                TODAY ({todayCount})
              </button>

              <button
                onClick={() => setActiveTab('FINISHED')}
                className={`flex-1 overflow-hidden py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1 md:gap-2 transition-all cursor-pointer ${
                  activeTab === 'FINISHED'
                    ? 'bg-neutral-50 text-neutral-800 shadow-xs border border-neutral-200'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                FINISHED ({finishedCount})
              </button>
            </div>

          </div>

          {/* Matches lists stack */}
          {loading ? (
            <MatchGridSkeleton count={3} />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredMatches.length > 0 ? (
                  filteredMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white border border-neutral-200/60 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 my-4 shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-neutral-900 text-sm">No matches in this league</h4>
                      <p className="text-neutral-400 text-xs">
                        There are currently no {activeTab.toLowerCase()} matches listed under {activeCategory === 'ALL' ? 'any' : activeCategory} league. Check back later or view our full schedules.
                      </p>
                    </div>
                    {/* Fallback actions */}
                    {activeCategory !== 'ALL' && (
                      <button
                        onClick={() => setActiveCategory('ALL')}
                        className="mt-2 text-xs font-display font-semibold text-zim-green hover:underline cursor-pointer"
                      >
                        Reset filters to view all matches
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Ad banner placeholer */}
          <AdPlaceholder type="banner" />

        </div>

        {/* Right sidebar column on desktop (ZPSL League Standings and widget spaces) */}
        <div id="sidebar-widgets" className="space-y-6">
          
          {/* Sidebar Tabs: ZPSL League Table & Player Stats */}
          <div className="bg-white border border-neutral-200/60 rounded-3xl p-5 shadow-xs">
            <div className="flex border-b border-neutral-100 pb-2 mb-4 justify-between items-center">
              <h3 className="font-display font-bold text-sm text-neutral-950 flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-zim-green" />
                Schedules & Stats
              </h3>
              
              <div className="flex bg-neutral-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setSidebarTab('STATS')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    sidebarTab === 'STATS' ? 'bg-white text-neutral-900 shadow-3xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  TOP SCORERS
                </button>
                <button
                  onClick={() => setSidebarTab('ZPSL')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    sidebarTab === 'ZPSL' ? 'bg-white text-neutral-900 shadow-3xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  ZPSL TABLE
                </button>
              </div>
            </div>

            {sidebarTab === 'ZPSL' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-neutral-400 font-mono border-b border-neutral-100">
                      <th className="py-2 font-semibold">Row</th>
                      <th className="py-2 font-semibold">Team</th>
                      <th className="py-2 text-center font-semibold">P</th>
                      <th className="py-2 text-center font-semibold">Pts</th>
                      <th className="py-2 text-right font-semibold hidden md:table-cell">Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {standings.map((team) => (
                      <tr key={team.rank} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-2.5 font-semibold font-mono text-neutral-500 w-8">
                          {team.rank}
                        </td>
                        <td className="py-2.5 font-bold text-neutral-800">
                          {team.team}
                        </td>
                        <td className="py-2.5 text-center text-neutral-500 font-medium font-mono">
                          {team.played}
                        </td>
                        <td className="py-2.5 text-center text-neutral-900 font-bold font-mono">
                          {team.points}
                        </td>
                        <td className="py-2.5 text-right hidden md:table-cell">
                          <div className="flex gap-1 justify-end">
                            {team.form.map((f, idx) => (
                              <span 
                                key={idx} 
                                className={`w-4 h-4 rounded text-[9px] font-bold inline-flex items-center justify-center font-mono text-white ${
                                  f === 'W' ? 'bg-[#009739]' : f === 'D' ? 'bg-[#FFD100] text-neutral-800' : 'bg-[#D62828]'
                                }`}
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-[#009739] font-semibold">
                  <span>Zim Premier League matches stream here</span>
                  <Link href="/?filter=ZPSL" className="hover:underline flex items-center gap-0.5">
                    View Local Matches &rsaquo;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {statsLoading ? (
                  <div className="space-y-2 py-4">
                    <div className="h-4 bg-neutral-100 rounded-sm animate-pulse w-3/4"></div>
                    <div className="h-12 bg-neutral-100 rounded-lg animate-pulse"></div>
                    <div className="h-12 bg-neutral-100 rounded-lg animate-pulse"></div>
                    <div className="h-12 bg-neutral-100 rounded-lg animate-pulse"></div>
                  </div>
                ) : stats && stats.length > 0 ? (
                  stats.slice(0, 1).map((category, catIdx) => (
                    <div key={catIdx} className="space-y-3">
                      <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
                        {category.title} — Premier League
                      </p>
                      <div className="divide-y divide-neutral-100">
                        {category.players.slice(0, 5).map((player, pIdx) => {
                          const badgeUrl = player.teamBadgeSlug 
                            ? (player.teamBadgeSlug.startsWith('enet/') || player.teamBadgeSlug.startsWith('teambadge/'))
                              ? `https://storage.livescore.com/images/team/high/${player.teamBadgeSlug}.png`
                              : `https://storage.livescore.com/images/team/high/${player.teamBadgeSlug}.png`
                            : null;

                          return (
                            <div key={pIdx} className="py-2 flex items-center justify-between text-xs gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-neutral-400 font-bold w-4 text-center shrink-0">
                                  {player.rank || pIdx + 1}
                                </span>
                                {badgeUrl && (
                                  <img 
                                    src={badgeUrl} 
                                    alt={player.teamName} 
                                    className="w-5 h-5 object-contain shrink-0"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      // hide on load failure
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold text-neutral-800 truncate">{player.name}</p>
                                  <p className="text-[10px] text-neutral-400 font-medium truncate">{player.teamName}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="font-mono font-extrabold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg">
                                  {Object.values(player.stats)[0]} {Object.keys(player.stats)[0] || 'Goals'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-neutral-400 text-xs">
                    No stats available today. Check back during kickoffs!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ad spot sidebar */}
          <AdPlaceholder type="sidebar" />

          {/* High Fidelity Support / FAQ Widget */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-5 text-neutral-600">
            <h4 className="font-display font-bold text-neutral-900 text-xs flex items-center gap-2 mb-2 uppercase tracking-wide">
              <Network className="w-4 h-4 text-neutral-500" />
              Low Internet Streaming Guide
            </h4>
            <p className="text-xs leading-relaxed mb-3 text-neutral-500">
              In Zimbabwe and facing slow bundles? We recommend switching to **Server 3** on our watch pages which compresses data streams for minimal bandwidth use.
            </p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="font-mono bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded font-bold">ZIM-CON</span>
              <span className="text-neutral-400">Version 1.0.4 • Light Mode</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="h-10 bg-neutral-200/50 rounded-2xl w-1/4 mb-6 animate-pulse"></div>
        <div className="space-y-4">
          <div className="h-32 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
          <div className="h-32 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
