'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
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
import { MatchGridSkeleton } from '@/components/skeleton-loader';
import { fetchLivescoresDirect, fetchStatsDirect } from '@/lib/totalsports-client';

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
  
  const [activeTab, setActiveTab] = useState<'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED'>(initialTab || 'TODAY');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [sidebarTab, setSidebarTab] = useState<'STANDINGS' | 'STATS'>('STANDINGS');

  const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Fetch failed');
    return res.json();
  });

  // Load real scores directly on the client to avoid server-side request blocking
  const { data: livescoreData, error: livescoreError, isLoading: loading } = useSWR('livescores-direct', () => fetchLivescoresDirect(), {
    refreshInterval: 25000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const matches = React.useMemo<Match[]>(() => {
    if (livescoreData && livescoreData.matches) {
      return livescoreData.matches;
    }
    // Return mock data if there is an error or no data is fetched yet (while not loading)
    if (livescoreError) {
      return [
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
        } as Match,
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
        } as Match
      ];
    }
    return [];
  }, [livescoreData, livescoreError]);

  // Load player statistics directly on the client to avoid server-side request blocking
  const { data: statsData, isLoading: statsLoading } = useSWR('stats-direct', () => fetchStatsDirect(), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const stats = statsData || [];

  // Load major league standings from API proxy using SWR
  const { data: standingsData, isLoading: standingsLoading } = useSWR(`/api/standings?competition=${encodeURIComponent(activeCategory)}`, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const standings = standingsData || [];

  // Sync category filter and tab from URL search params if present
  useEffect(() => {
    if (initialCategory) {
      setTimeout(() => setActiveCategory(initialCategory), 0);
    }
    if (initialTab) {
      setTimeout(() => setActiveTab(initialTab), 0);
    }
  }, [initialCategory, initialTab]);

  const filteredMatches = React.useMemo(() => {
    return matches.filter((match: Match) => {
      // 1. Status Filter
      const matchesStatus = match.status === activeTab;
      
      // 2. League Filter
      if (activeCategory === 'ALL') {
        return matchesStatus;
      }
      return matchesStatus && match.competition === activeCategory;
    });
  }, [matches, activeTab, activeCategory]);

  const liveCount = React.useMemo(() => matches.filter((m: Match) => m.status === 'LIVE').length, [matches]);
  const todayCount = React.useMemo(() => matches.filter((m: Match) => m.status === 'TODAY').length, [matches]);
  const upcomingCount = React.useMemo(() => matches.filter((m: Match) => m.status === 'UPCOMING').length, [matches]);
  const finishedCount = React.useMemo(() => matches.filter((m: Match) => m.status === 'FINISHED').length, [matches]);

  const majorLeagues = React.useMemo(() => [
    'English Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1', 
    'Champions League', 'Europa League', 'ZPSL', 'Zimbabwe Premier Soccer League'
  ], []);
  
  const tabMatches = React.useMemo(() => {
    return matches.filter((m: Match) => m.status === activeTab);
  }, [matches, activeTab]);

  // Pre-compute a map of competition -> leagueLogoUrl to optimize filter map rendering
  const leagueLogoMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    matches.forEach((m: Match) => {
      if (m.competition && m.leagueLogoUrl) {
        map[m.competition] = m.leagueLogoUrl;
      }
    });
    return map;
  }, [matches]);

  const leagueFilters = React.useMemo(() => {
    const uniqueLeaguesList = Array.from(new Set(tabMatches.map((m: Match) => m.competition as string))) as string[];
    const sorted = uniqueLeaguesList.sort((a: string, b: string) => {
      const aIsMajor = majorLeagues.some(ml => a.toLowerCase().includes(ml.toLowerCase()));
      const bIsMajor = majorLeagues.some(ml => b.toLowerCase().includes(ml.toLowerCase()));
      if (aIsMajor && !bIsMajor) return -1;
      if (!aIsMajor && bIsMajor) return 1;
      return a.localeCompare(b);
    });
    return ['ALL', ...sorted];
  }, [tabMatches, majorLeagues]);

  const groupedTodayMatches = React.useMemo(() => {
    const groups: Record<string, { leagueName: string; leagueLogoUrl?: string; matches: Match[] }> = {};
    filteredMatches.forEach((m: Match) => {
      if (!groups[m.competition]) {
        groups[m.competition] = {
          leagueName: m.competition,
          leagueLogoUrl: m.leagueLogoUrl,
          matches: [],
        };
      }
      groups[m.competition].matches.push(m);
    });
    return Object.values(groups);
  }, [filteredMatches]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      
      {/* Hero section */}
      <section id="hero" className="w-full p-6 md:p-10 mb-8 md:mb-12 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        
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
            Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly
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
                {leagueFilters.map((league) => {
                  const leagueLogo = league !== 'ALL' ? leagueLogoMap[league] : undefined;

                  return (
                    <button
                      key={league}
                      onClick={() => setActiveCategory(league)}
                      className={`shrink-0 cursor-pointer px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-lg font-display tracking-wide transition-all flex items-center gap-1.5 ${
                        activeCategory === league
                          ? 'bg-zim-black text-white shadow-xs'
                          : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}
                    >
                      {leagueLogo && (
                        <Image
                          src={leagueLogo}
                          alt=""
                          width={14}
                          height={14}
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      {league}
                    </button>
                  );
                })}
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
                className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeTab}-${activeCategory}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  {filteredMatches.length > 0 ? (
                    activeTab === 'TODAY' ? (
                      // Grouped by league on Today's tab
                      groupedTodayMatches.map((group) => (
                        <div key={group.leagueName} className="space-y-3">
                          <div className="flex items-center gap-2 px-1 py-1">
                            {group.leagueLogoUrl ? (
                              <Image
                                src={group.leagueLogoUrl}
                                alt={group.leagueName}
                                width={16}
                                height={16}
                                className="object-contain shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-neutral-150 flex items-center justify-center border border-neutral-300 text-[8px] font-bold text-neutral-500 shrink-0">
                                {group.leagueName.charAt(0)}
                              </div>
                            )}
                            <h3 className="font-display font-bold text-xs md:text-sm text-neutral-800 tracking-tight uppercase">
                              {group.leagueName}
                            </h3>
                            <span className="text-[10px] font-mono font-bold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full border border-neutral-200/50">
                              {group.matches.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {group.matches.map((match: Match) => (
                              <MatchCard key={match.id} match={match} />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Normal flat list for other tabs
                      <div className="space-y-3">
                        {filteredMatches.map((match: Match) => (
                          <MatchCard key={match.id} match={match} />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="bg-white border border-neutral-200/60 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 my-4 shadow-2xs">
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
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Ad banner placeholer */}
        </div>

        {/* Right sidebar column on desktop (ZPSL League Standings and widget spaces) */}
        <div id="sidebar-widgets" className="space-y-6">
          
          {/* Sidebar Tabs: League Table & Player Stats */}
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
                  onClick={() => setSidebarTab('STANDINGS')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    sidebarTab === 'STANDINGS' ? 'bg-white text-neutral-900 shadow-3xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  STANDINGS
                </button>
              </div>
            </div>

            {sidebarTab === 'STANDINGS' ? (
              <div className="overflow-x-auto">
                {standingsLoading ? (
                  <div className="space-y-2 py-4">
                    <div className="h-4 bg-neutral-100 rounded-sm animate-pulse w-3/4"></div>
                    <div className="h-12 bg-neutral-100 rounded-lg animate-pulse"></div>
                    <div className="h-12 bg-neutral-100 rounded-lg animate-pulse"></div>
                  </div>
                ) : standings && standings.length > 0 ? (
                  <>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-neutral-400 font-mono border-b border-neutral-100">
                          <th className="py-2 font-semibold">#</th>
                          <th className="py-2 font-semibold">Team</th>
                          <th className="py-2 text-center font-semibold">P</th>
                          <th className="py-2 text-center font-semibold">Pts</th>
                          <th className="py-2 text-right font-semibold hidden md:table-cell">Form</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {standings.map((team: any) => (
                          <tr key={team.rank} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-2.5 font-semibold font-mono text-neutral-500 w-8">
                              {team.rank}
                            </td>
                            <td className="py-2.5 font-bold text-neutral-800">
                              <div className="flex items-center gap-2">
                                {team.logoUrl && (
                                  <Image 
                                    src={team.logoUrl} 
                                    alt={team.team} 
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 object-contain shrink-0"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <span className="truncate">{team.team}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-center text-neutral-500 font-medium font-mono">
                              {team.played}
                            </td>
                            <td className="py-2.5 text-center text-neutral-900 font-bold font-mono">
                              {team.points}
                            </td>
                            <td className="py-2.5 text-right hidden md:table-cell">
                              <div className="flex gap-1 justify-end">
                                {team.form.map((f: string, idx: number) => (
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
                      <span>Major League Standings</span>
                      <Link href="/?filter=premier-league" className="hover:underline flex items-center gap-0.5">
                        View Match Feeds &rsaquo;
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-neutral-400 text-xs">
                    No standings available at the moment.
                  </div>
                )}
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
                  stats.slice(0, 1).map((category: StatCategory, catIdx: number) => (
                    <div key={catIdx} className="space-y-3">
                      <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
                        {category.title} — English Premier League
                      </p>
                      <div className="divide-y divide-neutral-100">
                        {category.players.slice(0, 5).map((player: PlayerStat, pIdx: number) => {
                          const badgeUrl = (player as any).logoUrl || null;

                          return (
                            <div key={pIdx} className="py-2 flex items-center justify-between text-xs gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-neutral-400 font-bold w-4 text-center shrink-0">
                                  {player.rank || pIdx + 1}
                                </span>
                                {badgeUrl && (
                                  <Image 
                                    src={badgeUrl} 
                                    alt={player.teamName} 
                                    width={20}
                                    height={20}
                                    className="w-5 h-5 object-contain shrink-0"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
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
