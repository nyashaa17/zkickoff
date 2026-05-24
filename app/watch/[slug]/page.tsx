'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { 
  Play, 
  Tv, 
  ArrowLeft, 
  AlertTriangle, 
  RefreshCcw, 
  MapPin, 
  Users, 
  Share2, 
  Info, 
  VolumeX, 
  ExternalLink,
  Award,
  Video,
  ListOrdered,
  Clock,
  Flame,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match } from '@/lib/matches-data';
import { DetailedPageSkeleton } from '@/components/skeleton-loader';
import { TeamLogo } from '@/components/team-logo';
import Breadcrumbs from '@/components/breadcrumbs';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function WatchPage({ params }: PageProps) {
  const { slug } = use(params);
  
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
  
  const [activeServer, setActiveServer] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [detailTab, setDetailTab] = useState<'COMMENTARY' | 'DETAILS'>('COMMENTARY');

  // Set isMounted to true on client load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Fetch failed');
    return res.json();
  });

  const matchId = slug.split('-').pop() || '0';

  // 1. Fetch Livescore
  const { data: lData } = useSWR('/api/livescore', fetcher, {
    refreshInterval: 20000,
    revalidateOnFocus: true,
  });

  let match: Match | undefined = undefined;
  let allMatches: Match[] = [];

  if (lData && lData.matches) {
    allMatches = lData.matches;
    match = allMatches.find((m: Match) => m.id === matchId);
  }

  // 2. Fetch Match buttons (servers)
  const homeParam = encodeURIComponent(fallbackData.homeName);
  const awayParam = encodeURIComponent(fallbackData.awayName);
  const { data: bData } = useSWR(`/api/match-buttons/${matchId}?home=${homeParam}&away=${awayParam}`, fetcher, {
    revalidateOnFocus: true,
  });

  let servers: { id: string; name: string; embedUrl: string }[] = [];
  if (bData && bData.servers && bData.servers.length > 0) {
    servers = bData.servers;
    // Auto select first server if activeServer is empty
    if (!activeServer && isMounted) {
      setTimeout(() => setActiveServer(servers[0].id), 0);
    }
  }

  // 3. Fetch Commentary
  const { data: cData } = useSWR(`/api/commentary/${matchId}`, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  let commentary: { time: number; text: string }[] = [];
  if (cData) {
    let entries: { time: number; text: string }[] = [];
    if (cData.liveCommentary && Array.isArray(cData.liveCommentary)) {
      entries = [...cData.liveCommentary];
    }
    if (cData.manualCommentary && Array.isArray(cData.manualCommentary)) {
      // filter out duplicates
      cData.manualCommentary.forEach((m: any) => {
        if (!entries.some(e => e.text === m.text)) {
          entries.push(m);
        }
      });
    }
    // Sort by minute desc
    entries.sort((a, b) => b.time - a.time);
    commentary = entries;
  }

  // Copy link to share stream
  const copyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (!isMounted) {
    return <DetailedPageSkeleton />;
  }

  // Related matches selection: same category or live matches (excluding current)
  const queryMatch: Match = match || {
    id: fallbackData.id,
    slug: slug,
    teams: {
      home: { name: fallbackData.homeName, code: fallbackData.homeName.slice(0, 3).toUpperCase(), logoColor: '#009739', logoUrl: undefined },
      away: { name: fallbackData.awayName, code: fallbackData.awayName.slice(0, 3).toUpperCase(), logoColor: '#D62828', logoUrl: undefined }
    },
    score: { home: 0, away: 0 },
    status: 'LIVE' as const,
    competition: 'Football Match',
    leagueLogoUrl: undefined,
    kickoffTime: 'Live Score Now',
    dateString: 'Today',
    category: 'INTERNATIONAL' as const,
    venue: 'National Sports Stadium, Harare',
    spectators: '18,000',
    servers: []
  };

  const relatedMatches = allMatches
    .filter((m) => m.id !== queryMatch.id && m.status !== 'FINISHED' && m.dateString !== 'Yesterday' && (m.category === queryMatch.category || m.status === 'LIVE'))
    .slice(0, 4);

  const isLive = queryMatch.status === 'LIVE';

  // Rendering server helper tags
  const renderServersList = servers.length > 0 ? servers : [
    {
      id: `fallback-srv-1`,
      name: `Stream Feed HD (Primary)`,
      embedUrl: `https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fallbackData.homeName + ' vs ' + fallbackData.awayName)}&stream=1`
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
      {/* Back button and breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-neutral-200/40 pb-4">
        <Breadcrumbs 
          items={[
            { label: 'Live Broadcasts', href: '/live' },
            { label: `${queryMatch.teams.home.name} vs ${queryMatch.teams.away.name}` }
          ]} 
        />
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#009739] hover:opacity-85 font-display transition-all py-1.5 px-3 bg-neutral-100/75 hover:bg-neutral-100 rounded-xl border border-neutral-200/40 shrink-0 self-start sm:self-auto shadow-4xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Live Feed
        </Link>
      </div>

      {/* Main layout grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column: Player & Core details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Streaming Player Terminal */}
          <div className="bg-white border border-neutral-200/70 rounded-none md:rounded-3xl overflow-hidden shadow-xs -mx-4 md:mx-0 border-x-0 md:border relative">
            
            {/* Video Iframe Embed wrapper */}
            <div className={`aspect-video relative overflow-hidden shadow-inner group transition-all duration-300 ${
              (queryMatch.status === 'TODAY' || queryMatch.status === 'UPCOMING') ? 'bg-white' : 'bg-black'
            }`}>
              {(queryMatch.status === 'TODAY' || queryMatch.status === 'UPCOMING') ? (
                <div id="not-started-empty-state" className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white">
                  {/* Decorative faint field elements to elevate visual style */}
                  <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
                    <div className="absolute inset-0 border-[2px] border-neutral-300 rounded-[30%] scale-[0.6] top-[-30%]"></div>
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-neutral-300"></div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 bg-neutral-50 border border-neutral-100 rounded-full flex items-center justify-center mb-5 shadow-2xs relative">
                      <div className="absolute inset-0 rounded-full bg-neutral-100 animate-ping opacity-30"></div>
                      <Clock className="w-7 h-7 text-[#009739] animate-pulse relative z-10" />
                    </div>
                    <h3 className="text-neutral-900 font-display font-extrabold text-lg md:text-xl mb-2.5">
                      Waiting for broadcast
                    </h3>
                    <p className="text-neutral-500 text-xs md:text-sm leading-relaxed mb-4">
                      The stream typically starts 5-10 minutes before kickoff. We&apos;ll connect automatically when it&apos;s live.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-neutral-100/80 rounded-full text-[10px] font-mono font-extrabold text-[#009739] border border-neutral-200/50">
                      <span className="w-1.5 h-1.5 bg-[#009739] rounded-full animate-pulse"></span>
                      SCHEDULED START: {queryMatch.kickoffTime}
                    </div>
                  </div>
                </div>
              ) : queryMatch.status === 'FINISHED' ? (
                <div id="stream-ended-empty-state" className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black">
                  {/* Decorative faint field elements to elevate visual style */}
                  <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                    <div className="absolute inset-0 border-[2px] border-neutral-800 rounded-[30%] scale-[0.6] top-[-30%]"></div>
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-neutral-850"></div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 bg-neutral-900 border border-neutral-850 rounded-full flex items-center justify-center mb-5 shadow-2xs relative">
                      <div className="absolute inset-0 rounded-full bg-neutral-800 animate-ping opacity-20"></div>
                      <Tv className="w-7 h-7 text-neutral-400 relative z-10" />
                    </div>
                    <h3 className="text-white font-display font-extrabold text-lg md:text-xl mb-2.5">
                      Stream has ended
                    </h3>
                    <p className="text-neutral-400 text-xs md:text-sm leading-relaxed mb-4">
                      The broadcast for this match has concluded. Check out the match stats or commentary.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-neutral-900 rounded-full text-[10px] font-mono font-extrabold text-neutral-400 border border-neutral-850">
                      <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full"></span>
                      CONCLUDED
                    </div>
                  </div>
                </div>
              ) : activeServer ? (
                <iframe
                  id="streamContainer"
                  className="absolute inset-0 w-full h-full border-none m-0 p-0 z-10 bg-black"
                  allowFullScreen
                  allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                  src={renderServersList.find(s => s.id === activeServer)?.embedUrl || renderServersList[0]?.embedUrl}
                  referrerPolicy="no-referrer"
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-neutral-900 via-neutral-950 to-black p-4">
                  {/* Decorative pure-CSS field visualization context replacing external stadium image */}
                  <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                    <div className="absolute inset-0 border-[2px] border-white/25 rounded-[30%] scale-[0.6] top-[-30%]"></div>
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/20"></div>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-white/20"></div>
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
                    <button 
                      onClick={() => {
                        if (renderServersList.length > 0) {
                          setActiveServer(renderServersList[0].id);
                        }
                      }}
                      className="w-16 h-16 cursor-pointer bg-zim-green text-white hover:scale-105 active:scale-95 transition-all rounded-full flex items-center justify-center mb-4 backdrop-blur-md shadow-lg shadow-zim-green/20"
                    >
                      <Play className="w-8 h-8 ml-1" />
                    </button>
                    <h3 className="text-white font-display font-bold text-xl mb-2">Live Broadcast Ready</h3>
                    <p className="text-neutral-300 text-xs mb-4">
                      Tap play or select an active server below to start streaming directly in our modern player wrapper.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action panel underneath the player */}
            <div className="p-4 md:p-5 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Stream Servers Selectors */}
              <div className="w-full sm:w-auto">
                <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2 text-center sm:text-left">
                  EXTERNAL BROADCAST SERVERS
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  {renderServersList.map((srv, idx) => (
                    <button
                      key={srv.id}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveServer(srv.id);
                      }}
                      className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all border flex items-center gap-1.5 ${
                        activeServer === srv.id
                          ? 'bg-zim-green text-white border-zim-green shadow-xs shadow-zim-green/10'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {srv.name.replace(' (HD)', '').replace(' (FHD)', '') || `Server ${idx + 1}`}
                      <ExternalLink className="w-3 h-3 text-current opacity-60" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Fast interactive tools */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end shrink-0">
                <button
                  onClick={copyShareLink}
                  className="cursor-pointer px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-display font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {copiedLink ? 'Link Copied!' : 'Share Stream'}
                </button>
              </div>

            </div>

          </div>

          {/* Fallback instruction banner */}
          <div id="fallback-ui-banner" className="bg-[#FFFDF4] border border-[#FFE1B5] rounded-2xl p-4 flex items-start gap-3">
            <VolumeX className="w-5 h-5 text-zim-yellow shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-display font-bold text-xs text-neutral-900">
                Stream not loading or no audio?
              </h4>
              <p className="text-neutral-600 text-xs leading-relaxed">
                Try switching to **Server 2** or **Server 3**. In case the stream requires enabling audio, tap on the speaker icon displayed directly inside of the iframe video player overlays.
              </p>
            </div>
          </div>

          {/* Tabbed Interactive Section: Commentary Feed & Scorecard details */}
          <div className="bg-white border border-neutral-200/60 rounded-3xl p-5 md:p-6 shadow-xs space-y-6">
            
            {/* Headers card */}
            <div className="flex flex-col gap-5 border-b border-neutral-100 pb-5">
              <div className="space-y-3">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5 justify-center md:justify-start">
                  {queryMatch.leagueLogoUrl ? (
                    <Image 
                      src={queryMatch.leagueLogoUrl} 
                      alt="" 
                      width={16}
                      height={16}
                      className="w-4 h-4 object-contain" 
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <Award className="w-3.5 h-3.5 text-zim-green" />
                  )}
                  {queryMatch.competition}
                </span>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                  {/* Home Team */}
                  <div className="flex items-center gap-2.5 md:flex-row flex-col text-center md:text-left md:w-5/12">
                    <TeamLogo 
                      name={queryMatch.teams.home.name} 
                      className="w-8 h-8 md:w-10 md:h-10 border border-neutral-100 shadow-3xs"
                      bzzBadge={queryMatch.teams.home.bzzBadge}
                      lsBadge={queryMatch.teams.home.lsBadge}
                    />
                    <div>
                      <span className="text-neutral-900 font-extrabold text-sm md:text-lg block tracking-tight line-clamp-1">{queryMatch.teams.home.name}</span>
                      <span className="text-[9px] text-[#009739] font-mono font-bold uppercase block md:hidden mt-0.5">HOME TEAM</span>
                    </div>
                  </div>

                  {/* Score & VS */}
                  <div className="flex flex-col items-center justify-center shrink-0 md:w-2/12 my-2 sm:my-0">
                    <div className="bg-neutral-100/95 border border-neutral-200/50 text-neutral-900 font-mono text-lg md:text-2xl font-black px-4 py-1.5 rounded-2xl tracking-wider min-w-[80px] text-center shadow-4xs">
                      {queryMatch.score?.home ?? 0} <span className="text-neutral-300 mx-0.5">:</span> {queryMatch.score?.away ?? 0}
                    </div>
                    <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest mt-1">
                      {isLive ? 'LIVE' : 'SCORE'}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center gap-2.5 md:flex-row-reverse flex-col text-center md:text-right md:w-5/12">
                    <TeamLogo 
                      name={queryMatch.teams.away.name} 
                      className="w-8 h-8 md:w-10 md:h-10 border border-neutral-100 shadow-3xs"
                      bzzBadge={queryMatch.teams.away.bzzBadge}
                      lsBadge={queryMatch.teams.away.lsBadge}
                    />
                    <div>
                      <span className="text-neutral-900 font-extrabold text-sm md:text-lg block tracking-tight line-clamp-1">{queryMatch.teams.away.name}</span>
                      <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase block md:hidden mt-0.5">AWAY TEAM</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center md:justify-end gap-2">
                <div className="flex bg-neutral-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    onClick={() => setDetailTab('COMMENTARY')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      detailTab === 'COMMENTARY' ? 'bg-white text-neutral-900 shadow-3xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3 text-zim-green" />
                    LIVE COMMENTARY
                  </button>
                  <button
                    onClick={() => setDetailTab('DETAILS')}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      detailTab === 'DETAILS' ? 'bg-white text-neutral-900 shadow-3xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <Info className="w-3 h-3" />
                    MATCH DETAILS
                  </button>
                </div>
              </div>
            </div>

            {detailTab === 'COMMENTARY' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin text-zim-green" />
                    REAL-TIME EVENTS FEED
                  </p>
                  <span className="bg-green-50 text-zim-green text-[9px] font-bold px-2 py-0.5 rounded border border-green-100 flex items-center gap-1 animate-pulse">
                    <span className="w-1 h-1 bg-zim-green rounded-full"></span>
                    POLLING ACTIVE
                  </span>
                </div>

                <div className="relative border-l border-neutral-100 pl-4 ml-2 space-y-5 py-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                  {commentary.length > 0 ? (
                    commentary.map((entry, index) => {
                      const textLower = entry.text.toLowerCase();
                      const isGoal = textLower.includes('goal') || textLower.includes('g-o-a-l');
                      const isYellowCard = textLower.includes('yellow card');
                      const isRedCard = textLower.includes('red card');

                      return (
                        <div key={index} className="relative group text-xs text-neutral-700 leading-relaxed">
                          {/* Event bullet marker */}
                          <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border-2 bg-white transition-transform group-hover:scale-125 ${
                            isGoal ? 'border-zim-yellow bg-zim-yellow animate-bounce' : isYellowCard ? 'border-amber-400 bg-amber-400' : isRedCard ? 'border-red-600 bg-red-600' : 'border-neutral-300'
                          }`} />
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className={`text-[10px] font-extrabold ${isGoal ? 'text-zim-yellow' : isYellowCard ? 'text-amber-500' : isRedCard ? 'text-red-500' : 'text-neutral-400'}`}>
                                {entry.time}&apos;
                              </span>
                              {isGoal && (
                                <span className="bg-yellow-50 text-yellow-600 border border-yellow-200 text-[8px] font-bold px-1 py-0.2 rounded font-sans uppercase">
                                  Goal Event
                                </span>
                              )}
                              {isYellowCard && (
                                <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[8px] font-bold px-1 py-0.2 rounded font-sans uppercase">
                                  Yellow Card
                                </span>
                              )}
                              {isRedCard && (
                                <span className="bg-red-50 text-red-600 border border-red-200 text-[8px] font-bold px-1 py-0.2 rounded font-sans uppercase">
                                  Red Card
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-neutral-700">{entry.text}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      No live events reported yet. Tap switch servers to verify kickoff states.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stadium/Spectators metrics info list */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-neutral-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Stadium Venue</p>
                      <p className="text-xs font-semibold text-neutral-800 line-clamp-1">{queryMatch.venue}</p>
                    </div>
                  </div>

                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center gap-3">
                    <Users className="w-5 h-5 text-neutral-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Expected Crowd</p>
                      <p className="text-xs font-semibold text-neutral-800">{queryMatch.spectators} cap</p>
                    </div>
                  </div>

                  <div className="col-span-2 md:col-span-1 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center gap-3">
                    <Info className="w-5 h-5 text-neutral-400 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">Category</p>
                      <p className="text-xs font-semibold text-neutral-800">Soccer • {queryMatch.category}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
                  <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zim-green" />
                    ZimKickOff Smart-Codec Configured
                  </h4>
                  <p className="text-neutral-500 text-[11px] leading-relaxed">
                    This stream uses adaptive HLS/MPEG-DASH stream segments to bypass regional connection drops and deliver smooth 1080p highlights. Switch broadcast pipelines above in case of buffering. No VPN or accounts needed.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Right Sidebar: Sponsor spots and related streams */}
        <div className="space-y-6">
          
          {/* Related matches list section */}
          <div className="bg-white border border-neutral-200/60 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="font-display font-bold text-sm text-neutral-950 pb-2 border-b border-neutral-100 flex items-center justify-between">
              <span>Related Football Streams</span>
              <span className="bg-neutral-100 text-neutral-600 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded">
                RECOMMENDED
              </span>
            </h3>

            <div className="flex flex-col gap-3">
              {relatedMatches.length > 0 ? (
                relatedMatches.map((m) => (
                  <Link href={`/watch/${m.slug}`} key={m.id} className="block group">
                    <div className="p-3 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200/50 hover:border-neutral-200 rounded-xl transition-all flex items-center justify-between gap-3 text-left">
                      <div className="space-y-1 overflow-hidden">
                        <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block font-bold truncate">
                          {m.competition}
                        </span>
                        <p className="text-xs font-bold text-neutral-800 line-clamp-1 group-hover:text-zim-green transition-colors">
                          {m.teams.home.name} vs {m.teams.away.name}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {m.status === 'LIVE' ? (
                          <span className="bg-red-50 text-zim-red text-[9px] font-bold px-2 py-0.5 rounded border border-red-100 animate-pulse">
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 font-mono font-bold bg-white border border-neutral-200/40 px-2 py-0.5 rounded shadow-3xs">
                            {m.kickoffTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-neutral-400 text-xs text-center py-4">No related streaming schedules.</p>
              )}
            </div>

            <div className="pt-2 text-center">
              <Link href="/" className="text-xs font-semibold text-[#009739] hover:underline">
                View all scheduled streams &rsaquo;
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
