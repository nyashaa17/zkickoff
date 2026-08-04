'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Users, 
  Tv, 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Award, 
  ThumbsUp,
  BarChart2,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Star,
  Share2,
  ListOrdered,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Match } from '@/lib/matches-data';
import { TeamLogo } from '@/components/team-logo';
import { fetchLivescoresDirect, fetchCommentaryDirect } from '@/lib/totalsports-client';
import Breadcrumbs from '@/components/breadcrumbs';
import BannerAd from '@/components/banner-ad';
import { motion, AnimatePresence } from 'motion/react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function MatchPreviewPage({ params }: PageProps) {
  const { slug } = use(params);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LINEUPS' | 'ODDS' | 'STATS' | 'EVENTS'>('SUMMARY');
  const [isStarred, setIsStarred] = useState(false);
  const [shareText, setShareText] = useState('Share');
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: `${queryMatch?.teams?.home?.name} vs ${queryMatch?.teams?.away?.name} Live Stream`,
      text: `Watch live stream and check odds comparison for ${queryMatch?.teams?.home?.name} vs ${queryMatch?.teams?.away?.name}!`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareText('Copied!');
        setShowShareTooltip(true);
        setTimeout(() => {
          setShowShareTooltip(false);
          setShareText('Share');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  // Load client parameters
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      
      // Star status
      const savedStar = localStorage.getItem(`star-${slug}`);
      if (savedStar === 'true') {
        setIsStarred(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [slug]);

  const toggleStar = () => {
    const nextStarred = !isStarred;
    setIsStarred(nextStarred);
    localStorage.setItem(`star-${slug}`, String(nextStarred));
  };

  // Parse slug fallback values in case livescore isn't available
  const getSlugFallback = () => {
    try {
      const parts = slug.split('-');
      const id = parts[parts.length - 1] || '0';
      const teamsPart = parts.slice(0, parts.length - 1).join('-');
      const teams = teamsPart.split('-vs-');
      const homeName = teams[0] 
        ? teams[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
        : 'Home Team';
      const awayName = teams[1] 
        ? teams[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') 
        : 'Away Team';
      
      return { homeName, awayName, id };
    } catch (e) {
      return { homeName: 'Home Team', awayName: 'Away Team', id: '0' };
    }
  };

  const fallbackData = getSlugFallback();
  const matchId = slug.split('-').pop() || '0';

  // Fetch livescore matches list from direct API
  const { data: lData } = useSWR('livescores-direct', () => fetchLivescoresDirect(), {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  // Fetch Commentary directly
  const { data: cData } = useSWR(`commentary-${matchId}`, () => fetchCommentaryDirect(matchId), {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const { data: bzzoiroData, isValidating: isLoadingBzzoiro } = useSWR(
    `/api/bzzoiro/match-preview?home=${encodeURIComponent(fallbackData.homeName)}&away=${encodeURIComponent(fallbackData.awayName)}`,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch bzzoiro preview data');
      return res.json();
    },
    { revalidateOnFocus: false, revalidateIfStale: false }
  );

  let match: Match | undefined = undefined;
  let allMatches: Match[] = [];

  if (lData && lData.matches) {
    allMatches = lData.matches;
    match = allMatches.find((m: Match) => m.id === matchId);
  }

  const queryMatch: Match = match || {
    id: fallbackData.id,
    slug: slug,
    teams: {
      home: { name: fallbackData.homeName, code: fallbackData.homeName.slice(0, 3).toUpperCase(), logoColor: '#009739', logoUrl: undefined },
      away: { name: fallbackData.awayName, code: fallbackData.awayName.slice(0, 3).toUpperCase(), logoColor: '#D62828', logoUrl: undefined }
    },
    score: { home: 0, away: 0 },
    status: 'UPCOMING' as const,
    competition: 'Football Match',
    leagueLogoUrl: undefined,
    kickoffTime: '21:00',
    dateString: 'Today',
    category: 'INTERNATIONAL' as const,
    venue: 'Stadium',
    spectators: '45,000',
    servers: []
  };

  const isLive = queryMatch.status === 'LIVE';
  const isFinished = queryMatch.status === 'FINISHED';
  const isUpcoming = queryMatch.status === 'UPCOMING' || queryMatch.status === 'TODAY';

  // Filter other recommended/related streams
  const seenStreams = new Set<string>();
  const relatedStreams = allMatches
    .filter((m) => {
      if (!m || !m.id || m.id === queryMatch.id || seenStreams.has(m.id)) return false;
      if (m.status === 'FINISHED' || m.dateString === 'Yesterday') return false;
      seenStreams.add(m.id);
      return true;
    })
    .slice(0, 4);

  if (!isMounted) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="h-8 bg-neutral-200/50 rounded-lg animate-pulse w-1/3"></div>
        <div className="h-64 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
          <div className="h-96 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Abbreviated shortcodes for pill filters under H2H
  const homeShort = queryMatch.teams.home.code || queryMatch.teams.home.name.slice(0, 3).toUpperCase();
  const awayShort = queryMatch.teams.away.code || queryMatch.teams.away.name.slice(0, 3).toUpperCase();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 bg-[#F8FAFC] min-h-screen">
      <h1 className="sr-only">
        Match Preview & Live Stats: {queryMatch.teams.home.name} vs {queryMatch.teams.away.name} | ZimKickOff
      </h1>
      
      {/* Top Header Navigation Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-neutral-200/40 pb-4">
        <Breadcrumbs 
          items={[
            { label: 'Live Broadcasts', href: '/live' },
            { label: `${queryMatch.teams.home.name} vs ${queryMatch.teams.away.name} (Preview)` }
          ]} 
        />
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-[#009739] hover:opacity-85 font-display transition-all py-1.5 px-3 bg-white hover:bg-neutral-50 rounded-xl border border-neutral-200/50 shrink-0 self-start sm:self-auto shadow-4xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Feed
        </Link>
      </div>

      {/* MATCH PREVIEW HEADER BLOCK - INSPIRED DIRECTLY BY FLASH SCORE DESIGN */}
      <div className="w-full bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-xs mb-6 relative">
        {/* World Cup / Competition indicator top strip */}
        <div className="w-full bg-neutral-50 border-b border-neutral-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-700 font-sans">
            {queryMatch.leagueLogoUrl ? (
              <div className="relative w-4.5 h-4.5">
                <Image 
                  src={queryMatch.leagueLogoUrl} 
                  alt="" 
                  fill 
                  className="object-contain" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            ) : (
              <Award className="w-4 h-4 text-[#009739]" />
            )}
            <span className="uppercase tracking-wider">
              {queryMatch.category === 'ZPSL' ? 'ZIMBABWE' : 'WORLD'}: {queryMatch.competition}
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            <button 
              onClick={handleShare}
              className="cursor-pointer p-1.5 hover:bg-neutral-200/60 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors relative group"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
              {showShareTooltip && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap animate-fade-in z-50">
                  {shareText}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero details: flags, matchup, date, kickoff times */}
        <div className="p-6 md:p-8 grid grid-cols-3 items-center justify-center text-center relative z-10">
          
          {/* Home Team */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-50 rounded-2xl flex items-center justify-center p-3 border border-neutral-200/60 shadow-5xs hover:scale-102 transition-transform">
              <TeamLogo 
                name={queryMatch.teams.home.name} 
                className="w-full h-full object-contain"
                bzzBadge={queryMatch.teams.home.bzzBadge}
                lsBadge={queryMatch.teams.home.lsBadge}
              />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm md:text-lg font-extrabold text-neutral-900 tracking-tight">
                {queryMatch.teams.home.name}
              </h2>
              {queryMatch.category === 'ZPSL' && (
                <span className="text-[10px] font-mono text-[#009739] font-bold bg-[#009739]/10 px-2 py-0.5 rounded">
                  ZSL League
                </span>
              )}
            </div>
          </div>

          {/* Time & Center Score indicator */}
          <div className="flex flex-col items-center justify-center">
            {isLive ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest font-mono">LIVE</span>
                </div>
                <div className="text-2xl md:text-4xl font-black font-mono tracking-tight text-neutral-950 flex items-center gap-2.5">
                  <span>{queryMatch.score?.home ?? 0}</span>
                  <span className="text-neutral-300 animate-pulse">:</span>
                  <span>{queryMatch.score?.away ?? 0}</span>
                </div>
                {queryMatch.minute && (
                  <span className="text-[10px] font-bold text-neutral-500 font-mono bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200/50">
                    {queryMatch.minute}&apos;
                  </span>
                )}
              </div>
            ) : isFinished ? (
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest bg-neutral-100 px-2 py-0.5 rounded">FINISHED</span>
                <div className="text-2xl md:text-4xl font-black font-mono tracking-tight text-neutral-950 flex items-center gap-2">
                  <span>{queryMatch.score?.home ?? 0}</span>
                  <span className="text-neutral-300">:</span>
                  <span>{queryMatch.score?.away ?? 0}</span>
                </div>
                <span className="text-[10px] font-bold text-neutral-400 block font-mono">FT</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono font-extrabold text-neutral-500 bg-neutral-100/80 border border-neutral-200/40 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block">
                  {queryMatch.dateString}
                </div>
                <div className="text-xl md:text-3xl font-extrabold text-neutral-900 tracking-tight font-display py-0.5">
                  —
                </div>
                <div className="text-[11px] font-mono font-bold text-neutral-500 flex items-center gap-1 justify-center">
                  <Clock className="w-3 h-3 text-neutral-400" />
                  <span>{queryMatch.kickoffTime}</span>
                </div>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center justify-center gap-2.5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-50 rounded-2xl flex items-center justify-center p-3 border border-neutral-200/60 shadow-5xs hover:scale-102 transition-transform">
              <TeamLogo 
                name={queryMatch.teams.away.name} 
                className="w-full h-full object-contain"
                bzzBadge={queryMatch.teams.away.bzzBadge}
                lsBadge={queryMatch.teams.away.lsBadge}
              />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm md:text-lg font-extrabold text-neutral-900 tracking-tight">
                {queryMatch.teams.away.name}
              </h2>
              {queryMatch.category === 'ZPSL' && (
                <span className="text-[10px] font-mono text-[#009739] font-bold bg-[#009739]/10 px-2 py-0.5 rounded">
                  ZSL League
                </span>
              )}
            </div>
          </div>

        </div>

        {/* SUB-NAVIGATION TAB LIST INSPIRED BY THE IMAGE */}
        <div className="w-full border-t border-neutral-200/70 overflow-x-auto scrollbar-none bg-white [transform:translate3d(0,0,0)] [will-change:transform]">
          <div className="flex px-3 gap-1 min-w-max">
            {[
              { id: 'SUMMARY', label: 'FACTS' },
              { id: 'LINEUPS', label: 'LINEUPS' },
              { id: 'ODDS', label: 'ODDS' },
              { id: 'STATS', label: 'STATS' },
              { id: 'EVENTS', label: 'EVENTS & COMMENTARY' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`cursor-pointer px-4.5 py-4 text-[11px] font-bold tracking-wider relative transition-colors duration-200 ${
                    isActive ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Clickadilla Banner Ad */}
      <BannerAd />

      {/* CORE CONTENT LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Primary Column */}
        <div className="lg:col-span-2 space-y-6">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden [transform:translate3d(0,0,0)] [will-change:transform]"
            >
              
              {/* 1. FACTS (SUMMARY) TAB */}
              {activeTab === 'SUMMARY' && (
                <div className="p-5 md:p-6 space-y-6">
                  
                  {/* Facts / Pre-match */}
                  {isLoadingBzzoiro ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-neutral-100 rounded w-1/3 animate-pulse"></div>
                      <div className="h-20 bg-neutral-100 rounded-xl animate-pulse"></div>
                    </div>
                  ) : bzzoiroData?.metadata?.funfacts ? (
                    <div className="space-y-3">
                      <h3 className="font-display font-extrabold text-sm text-neutral-950 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#009739]" />
                        <span>Match Facts</span>
                      </h3>
                      <div className="space-y-2">
                        {bzzoiroData.metadata.funfacts.map((fact: any, idx: number) => (
                          <div key={idx} className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex gap-2">
                            <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-neutral-700">{fact.sentence}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500 italic">No pre-match facts available.</div>
                  )}

                  {/* Pitch specs */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/30 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Stadium Venue</span>
                      <strong className="text-neutral-800 font-display font-bold leading-tight">
                        {bzzoiroData?.event?.venue?.name || queryMatch.venue}
                      </strong>
                    </div>

                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/30 flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Expected Spectators</span>
                      <strong className="text-neutral-800 font-display font-bold leading-tight">
                        {bzzoiroData?.event?.venue?.capacity 
                          ? bzzoiroData.event.venue.capacity.toLocaleString() 
                          : bzzoiroData?.event?.attendance 
                            ? bzzoiroData.event.attendance.toLocaleString()
                            : queryMatch.spectators}
                      </strong>
                    </div>
                  </div>

                </div>
              )}

              {/* 2. LINEUPS TAB */}
              {activeTab === 'LINEUPS' && (
                <div className="p-5 md:p-6 space-y-6">
                  {isLoadingBzzoiro ? (
                    <div className="h-40 bg-neutral-100 rounded-xl animate-pulse"></div>
                  ) : bzzoiroData?.lineups && bzzoiroData.lineups.lineups ? (
                    <>
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                        <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider">
                          {bzzoiroData.lineups.lineup_status === 'confirmed' ? 'Confirmed Lineups' : 'Expected Lineups'}
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
                          Formations: {bzzoiroData.lineups.lineups.home?.formation} vs {bzzoiroData.lineups.lineups.away?.formation}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {['home', 'away'].map((side) => {
                          const lineup = bzzoiroData.lineups.lineups[side as 'home'|'away'];
                          if (!lineup) return null;
                          return (
                            <div key={side} className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
                                <TeamLogo name={lineup.team_name} className="w-5 h-5" />
                                <span className="font-display font-extrabold text-sm text-neutral-800">{lineup.team_name}</span>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Starting Eleven</p>
                                <div className="space-y-1">
                                  {lineup.players?.map((p: any, pIdx: number) => (
                                    <div key={p.id ? `${p.id}-${pIdx}` : `player-${pIdx}`} className="flex items-center justify-between text-xs p-2 bg-neutral-50 rounded-md border border-neutral-200/30">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 ${side === 'home' ? 'bg-[#009739]' : 'bg-red-600'} text-white text-[9px] font-bold rounded flex items-center justify-center font-mono`}>
                                          {p.jersey_number || '-'}
                                        </span>
                                        <span className="font-medium text-neutral-800">{p.short_name || p.name}</span>
                                      </div>
                                      <span className="font-mono text-[9px] font-bold uppercase text-neutral-500 bg-neutral-200/50 px-1 py-0.5 rounded">
                                        {p.position}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-neutral-500 italic p-4 text-center">Lineup data is not available yet.</div>
                  )}
                </div>
              )}

              {/* 3. ODDS TAB */}
              {activeTab === 'ODDS' && (
                <div className="p-5 md:p-6 space-y-6">
                  {isLoadingBzzoiro ? (
                    <div className="h-40 bg-neutral-100 rounded-xl animate-pulse"></div>
                  ) : bzzoiroData?.odds?.markets ? (
                    <div className="space-y-5">
                      <div className="border-b border-neutral-100 pb-3">
                        <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider">
                          Interactive Betting Odds Index
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1X2 Market */}
                        {bzzoiroData.odds.markets['1x2'] && (
                          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-3">
                            <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Match Winner (1X2)</p>
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(bzzoiroData.odds.markets['1x2']).map(([outcome, outcomeData]: [string, any]) => {
                                const bookies = outcomeData?.bookmakers || {};
                                const odds = bookies['consensus']?.decimal_odds || bookies['oddssafari-consensus']?.decimal_odds || (Object.values(bookies)[0] as any)?.decimal_odds || outcomeData?.best_odds || '-';
                                return (
                                  <div key={outcome} className="p-2 bg-white rounded-md border border-neutral-200 text-center space-y-1">
                                    <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase block">{outcome}</span>
                                    <span className={`font-mono font-extrabold text-xs ${outcome === 'HOME' ? 'text-[#009739]' : outcome === 'AWAY' ? 'text-red-600' : 'text-neutral-600'}`}>
                                      {odds}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Double Chance */}
                        {bzzoiroData.odds.markets['double_chance'] && (
                          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-3">
                            <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Double Chance</p>
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(bzzoiroData.odds.markets['double_chance']).map(([outcome, outcomeData]: [string, any]) => {
                                const bookies = outcomeData?.bookmakers || {};
                                const odds = bookies['consensus']?.decimal_odds || bookies['oddssafari-consensus']?.decimal_odds || (Object.values(bookies)[0] as any)?.decimal_odds || outcomeData?.best_odds || '-';
                                return (
                                  <div key={outcome} className="p-2 bg-white rounded-md border border-neutral-200 text-center space-y-1">
                                    <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase block">{outcome}</span>
                                    <span className="font-mono font-extrabold text-xs text-neutral-800">
                                      {odds}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Over/Under 2.5 */}
                        {bzzoiroData.odds.markets['over_under_25'] && (
                          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-3">
                            <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Total Goals (2.5)</p>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(bzzoiroData.odds.markets['over_under_25']).map(([outcome, outcomeData]: [string, any]) => {
                                const bookies = outcomeData?.bookmakers || {};
                                const odds = bookies['consensus']?.decimal_odds || bookies['oddssafari-consensus']?.decimal_odds || (Object.values(bookies)[0] as any)?.decimal_odds || outcomeData?.best_odds || '-';
                                return (
                                  <div key={outcome} className="p-2 bg-white rounded-md border border-neutral-200 text-center space-y-1">
                                    <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase block">
                                      {outcome.includes('over') ? 'Over 2.5' : 'Under 2.5'}
                                    </span>
                                    <span className="font-mono font-extrabold text-xs text-neutral-800">
                                      {odds}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* BTTS */}
                        {bzzoiroData.odds.markets['btts'] && (
                          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-3">
                            <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Both Teams to Score</p>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(bzzoiroData.odds.markets['btts']).map(([outcome, outcomeData]: [string, any]) => {
                                const bookies = outcomeData?.bookmakers || {};
                                const odds = bookies['consensus']?.decimal_odds || bookies['oddssafari-consensus']?.decimal_odds || (Object.values(bookies)[0] as any)?.decimal_odds || outcomeData?.best_odds || '-';
                                return (
                                  <div key={outcome} className="p-2 bg-white rounded-md border border-neutral-200 text-center space-y-1">
                                    <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase block">{outcome}</span>
                                    <span className="font-mono font-extrabold text-xs text-neutral-800">
                                      {odds}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/40 text-xs text-amber-800 leading-normal flex gap-2">
                        <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <p>Odds shown are highest consensus market averages.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500 italic p-4 text-center">Odds are not currently available for this event.</div>
                  )}
                </div>
              )}

              {/* 4. STATS TAB */}
              {activeTab === 'STATS' && (
                <div className="p-5 md:p-6 space-y-6">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                    <BarChart2 className="w-4 h-4 text-[#009739]" />
                    <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider">Match Statistics</h3>
                  </div>

                  {isLoadingBzzoiro ? (
                    <div className="h-40 bg-neutral-100 rounded-xl animate-pulse"></div>
                  ) : bzzoiroData?.stats?.stats ? (
                    <div className="space-y-4">
                      {['ball_possession', 'total_shots', 'shots_on_target', 'corner_kicks', 'fouls', 'yellow_cards'].map((statKey) => {
                        const hStat = bzzoiroData.stats.stats.home?.[statKey] ?? 0;
                        const aStat = bzzoiroData.stats.stats.away?.[statKey] ?? 0;
                        const total = hStat + aStat;
                        const hPct = total > 0 ? (hStat / total) * 100 : 50;
                        const label = statKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        const isPct = statKey === 'ball_possession';
                        
                        return (
                          <div key={statKey} className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-neutral-600">
                              <span className="font-bold text-neutral-900 font-mono">{hStat}{isPct ? '%' : ''}</span>
                              <span className="font-semibold text-neutral-400 text-[10px] uppercase tracking-wider">{label}</span>
                              <span className="font-bold text-neutral-900 font-mono">{aStat}{isPct ? '%' : ''}</span>
                            </div>
                            <div className="w-full h-1.5 flex bg-neutral-100 rounded-full overflow-hidden">
                              <div className="bg-[#009739] h-full" style={{ width: `${hPct}%` }} />
                              <div className="bg-red-500 h-full" style={{ width: `${100 - hPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500 italic p-4 text-center">Detailed statistics are not available for this event yet.</div>
                  )}
                </div>
              )}

              {/* 5. EVENTS / COMMENTARY TAB */}
              {activeTab === 'EVENTS' && (
                <div className="p-5 md:p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider">
                      Live Action Events Logs
                    </h3>
                    <span className="bg-[#009739] text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full animate-pulse">
                      AUTO REFRESHEABLE
                    </span>
                  </div>

                  {/* Play-by-play vertical timeline */}
                  <div className="relative border-l border-neutral-200 ml-4 pl-6 space-y-6">
                    {cData && cData.liveCommentary && cData.liveCommentary.length > 0 ? (
                      cData.liveCommentary.map((log: any, idx: number) => {
                        return (
                          <div key={idx} className="relative">
                            {/* Dot indicator */}
                            <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white ring-4 ring-red-100/45" />
                            <div className="space-y-1.5">
                              <span className="text-xs font-mono font-extrabold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200/50">
                                {log.time}&apos; Minute
                              </span>
                              <p className="text-xs text-neutral-700 leading-normal font-medium">
                                {log.text}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-4 text-center text-xs text-neutral-400 space-y-2">
                        <AlertTriangle className="w-8 h-8 text-neutral-300 mx-auto" />
                        <p>No action events logged for this game yet. Check back closer to kickoff!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          
          {/* STREAM PLAYER LAUNCHER CALLOUT */}
          <div className="bg-white border border-neutral-200/70 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <h3 className="font-display font-extrabold text-sm text-neutral-950 pb-2 border-b border-neutral-100 flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-[#009739]" />
              Live Stream Links
            </h3>

            <Link 
              href={`/watch/${slug}`}
              className="w-full group cursor-pointer py-3.5 px-4 bg-[#009739] text-white hover:bg-opacity-95 rounded-xl font-display text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <Tv className="w-4 h-4 fill-white/10" />
              <span>{isFinished ? 'VIEW MATCH BROADCAST' : isLive ? 'WATCH LIVE STREAM' : 'CLICK HERE'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <p className="text-[10px] font-medium text-neutral-400 text-center">
              Multi-Server Pipeline • Dynamic Resolution Adaptive
            </p>
          </div>

          {/* VENUE / EVENT DETAILS */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-display font-extrabold text-xs text-neutral-950 pb-2 border-b border-neutral-100 flex items-center gap-1.5 uppercase tracking-wider">
              <Info className="w-3.5 h-3.5 text-[#009739]" />
              Match Information
            </h3>

            <div className="space-y-3.5 text-xs text-neutral-700">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide">Stadium Venue</p>
                  <p className="font-bold text-neutral-800 leading-tight">
                    {bzzoiroData?.event?.venue?.name || queryMatch.venue}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide">Stadium Capacity</p>
                  <p className="font-bold text-neutral-800 leading-tight">
                    {bzzoiroData?.event?.venue?.capacity 
                      ? `${bzzoiroData.event.venue.capacity.toLocaleString()} Capacity` 
                      : bzzoiroData?.event?.attendance 
                        ? `${bzzoiroData.event.attendance.toLocaleString()} Attendance`
                        : `${queryMatch.spectators} Spectators Expected`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Tv className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide">Competition category</p>
                  <p className="font-bold text-neutral-800 leading-tight">Football • {queryMatch.category}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-wide">Broadcast pipeline</p>
                  <p className="font-bold text-neutral-800 leading-tight">Uptilt Adaptive Multi-Server HLS</p>
                </div>
              </div>
            </div>
          </div>

          {/* OTHER SCHEDULED FOOTBALL STREAMS */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-display font-bold text-xs text-neutral-950 pb-2 border-b border-neutral-100 flex items-center justify-between uppercase tracking-wider">
              <span>More Football Streams</span>
              <span className="bg-neutral-100 text-neutral-600 font-mono text-[8px] font-bold px-1.5 py-0.5 rounded">
                LIVE & SCHED
              </span>
            </h3>

            <div className="flex flex-col gap-2.5">
              {relatedStreams.length > 0 ? (
                relatedStreams.map((m, idx) => (
                  <Link href={`/preview/${m.slug}`} key={`${m.id}-${idx}`} className="block group">
                    <div className="p-2.5 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200/50 hover:border-neutral-200 rounded-xl transition-all flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {/* Team Logos */}
                        <div className="flex -space-x-1.5 shrink-0">
                          <div className="w-5 h-5 bg-white rounded-full p-0.5 border border-neutral-200/80 flex items-center justify-center shadow-5xs">
                            <TeamLogo 
                              name={m.teams.home.name} 
                              className="w-full h-full object-contain"
                              bzzBadge={m.teams.home.bzzBadge}
                              lsBadge={m.teams.home.lsBadge}
                            />
                          </div>
                          <div className="w-5 h-5 bg-white rounded-full p-0.5 border border-neutral-200/80 flex items-center justify-center shadow-5xs">
                            <TeamLogo 
                              name={m.teams.away.name} 
                              className="w-full h-full object-contain"
                              bzzBadge={m.teams.away.bzzBadge}
                              lsBadge={m.teams.away.lsBadge}
                            />
                          </div>
                        </div>

                        <div className="space-y-0.5 overflow-hidden">
                          <span className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider block font-bold truncate">
                            {m.competition}
                          </span>
                          <p className="text-xs font-bold text-neutral-850 line-clamp-1 group-hover:text-[#009739] transition-colors">
                            {m.teams.home.name} vs {m.teams.away.name}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {m.status === 'LIVE' ? (
                          <span className="bg-red-50 text-red-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-red-100 animate-pulse">
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[9px] text-neutral-500 font-mono font-bold bg-white border border-neutral-200/40 px-1.5 py-0.5 rounded shadow-5xs">
                            {m.kickoffTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-neutral-400 text-xs text-center py-4">No other schedules active.</p>
              )}
            </div>

            <div className="pt-1 text-center">
              <Link href="/" className="text-xs font-semibold text-[#009739] hover:underline">
                View entire broadcast feeds &rsaquo;
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
