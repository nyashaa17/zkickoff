'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
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
import AdPlaceholder from '@/components/ad-placeholder';
import { DetailedPageSkeleton } from '@/components/skeleton-loader';

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
  
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [servers, setServers] = useState<{ id: string; name: string; embedUrl: string }[]>([]);
  const [commentary, setCommentary] = useState<{ time: number; text: string }[]>([]);
  
  const [activeServer, setActiveServer] = useState<string>('');
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState(false);
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

  // Main loader: fetch details from Livescore API Proxy + Match Buttons Proxy
  useEffect(() => {
    let active = true;
    const parts = slug.split('-');
    const matchId = parts[parts.length - 1];

    async function fetchData() {
      try {
        // 1. Fetch Livescore
        const lRes = await fetch('/api/livescore');
        if (!lRes.ok) throw new Error('Failed to load livescores');
        const lData = await lRes.json();
        
        if (!active) return;

        if (lData && lData.matches) {
          setAllMatches(lData.matches);
          const found = lData.matches.find((m: Match) => m.id === matchId);
          if (found) {
            setMatch(found);
          }
        }

        // 2. Fetch Match buttons (servers)
        const bRes = await fetch(`/api/match-buttons/${matchId}`);
        if (!bRes.ok) throw new Error('Failed to load match streams');
        const bData = await bRes.json();
        
        if (!active) return;

        if (bData && bData.servers && bData.servers.length > 0) {
          setServers(bData.servers);
          // Auto select first server if activeServer is empty
          if (!activeServer) {
            setActiveServer(bData.servers[0].id);
            setIframeSrc(bData.servers[0].embedUrl);
          }
        }
      } catch (err) {
        console.error('Watch page initial load error:', err);
      }
    }

    fetchData();

    // Setup periodic reload for livescore ticks on detail watch screen of 20 seconds
    const intervalObj = setInterval(fetchData, 20000);

    return () => {
      active = false;
      clearInterval(intervalObj);
    };
  }, [slug, activeServer]);

  // Commentary loader: fetch timeline from proxy on mount + periodic refresh
  useEffect(() => {
    let active = true;
    const parts = slug.split('-');
    const matchId = parts[parts.length - 1];

    async function loadCommentary() {
      try {
        const res = await fetch(`/api/commentary/${matchId}`);
        if (!res.ok) throw new Error('Failed to resolve commentary');
        const data = await res.json();
        
        if (!active) return;
        
        if (data) {
          // Merge liveCommentary and manualCommentary if existing
          let entries: { time: number; text: string }[] = [];
          if (data.liveCommentary && Array.isArray(data.liveCommentary)) {
            entries = [...data.liveCommentary];
          }
          if (data.manualCommentary && Array.isArray(data.manualCommentary)) {
            // filter out duplicates
            data.manualCommentary.forEach((m: any) => {
              if (!entries.some(e => e.text === m.text)) {
                entries.push(m);
              }
            });
          }
          
          // Sort by minute desc
          entries.sort((a, b) => b.time - a.time);
          setCommentary(entries);
        }
      } catch (err) {
        console.error('Commentary loading error:', err);
      }
    }

    loadCommentary();
    const timer = setInterval(loadCommentary, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  // Handle server switching safely
  const handleServerSwitch = (serverId: string, embedUrl: string) => {
    setPlayerLoading(true);
    setPlayerError(false);
    setActiveServer(serverId);
    setIframeSrc(embedUrl);
  };

  // Reload the stream player to fix stuttering
  const reloadStream = () => {
    setPlayerLoading(true);
    setPlayerError(false);
    const currentSrc = iframeSrc;
    const separator = currentSrc.includes('?') ? '&' : '?';
    setIframeSrc(`${currentSrc}${separator}reload=${Date.now()}`);
  };

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
  const queryMatch = match || {
    id: fallbackData.id,
    slug: slug,
    teams: {
      home: { name: fallbackData.homeName, code: fallbackData.homeName.slice(0, 3).toUpperCase(), logoColor: '#009739' },
      away: { name: fallbackData.awayName, code: fallbackData.awayName.slice(0, 3).toUpperCase(), logoColor: '#D62828' }
    },
    score: { home: 0, away: 0 },
    status: 'LIVE' as const,
    competition: 'Football Match',
    kickoffTime: 'Live Score Now',
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
      embedUrl: `https://king.totalsportss.online/embed?fixture=${fallbackData.id}&stream=1`
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
      {/* Back button and breadcrumbs */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#009739] hover:opacity-85 font-display transition-opacity">
          <ArrowLeft className="w-4 h-4" />
          Back to Live Feed
        </Link>
        <span className="text-[10px] md:text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest bg-white border border-neutral-200/50 px-3 py-1 rounded-xl shadow-2xs">
          Match ID: {queryMatch.id}
        </span>
      </div>

      {/* Main layout grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column: Player & Core details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Streaming Player Terminal */}
          <div className="bg-white border border-neutral-200/70 rounded-3xl overflow-hidden shadow-xs relative">
            
            {/* Top info track */}
            <div className="bg-neutral-950 px-4 py-3 text-white flex items-center justify-between gap-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-zim-yellow animate-pulse" />
                <span className="text-[11px] md:text-xs font-mono font-medium tracking-wide truncate max-w-[200px] sm:max-w-md text-white/90">
                  Streaming Source: {renderServersList.find(s => s.id === activeServer)?.name || "Direct Sports Feed (FHD)"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isLive ? (
                  <span className="bg-zim-red/10 border border-zim-red text-zim-red text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    LIVE
                  </span>
                ) : (
                  <span className="bg-neutral-800 text-neutral-400 text-[10px] font-mono px-2 py-0.5 rounded">
                    WARMUP
                  </span>
                )}
                <span className="text-white/40 text-xs hidden sm:inline font-mono">1080p 60fps</span>
              </div>
            </div>

            {/* Video Iframe Embed wrapper */}
            <div className="aspect-video bg-black relative">
              
              {/* Spinner loader displayed when player is starting */}
              {playerLoading && (
                <div className="absolute inset-0 bg-[#111] flex flex-col items-center justify-center text-center p-6 z-10 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full border-4 border-zim-green/20 border-t-zim-green animate-spin mb-3"></div>
                  <p className="text-sm font-semibold text-white tracking-wide">
                    Connecting to Football Feed...
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                    Connecting to server hosts. Please wait up to 3 seconds for broadcast sync.
                  </p>
                </div>
              )}

              {/* Real IFrame Embedding */}
              <iframe
                id="live-broadcasting-iframe"
                src={iframeSrc || renderServersList[0].embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full z-0 absolute inset-0"
                onLoad={() => setPlayerLoading(false)}
                onError={() => {
                  setPlayerLoading(false);
                  setPlayerError(true);
                }}
              />
            </div>

            {/* Action panel underneath the player */}
            <div className="p-4 md:p-5 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Stream Servers Selectors */}
              <div className="w-full sm:w-auto">
                <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2 text-center sm:text-left">
                  SWITCH BROADCAST SERVER
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  {renderServersList.map((srv, idx) => (
                    <button
                      key={srv.id}
                      onClick={() => handleServerSwitch(srv.id, srv.embedUrl)}
                      className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all border ${
                        activeServer === srv.id
                          ? 'bg-zim-green text-white border-zim-green shadow-xs shadow-zim-green/10'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {srv.name.replace(' (HD)', '').replace(' (FHD)', '') || `Server ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fast interactive tools */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end shrink-0">
                <button
                  onClick={reloadStream}
                  className="cursor-pointer px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-display font-medium flex items-center justify-center gap-1.5 transition-colors"
                  title="Reload source connection"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Reload Player
                </button>
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-zim-green" />
                  {queryMatch.competition}
                </span>
                <h2 className="font-display font-bold text-xl md:text-2xl text-neutral-950 flex items-center gap-3">
                  <span className="text-neutral-800">{queryMatch.teams.home.name}</span>
                  <span className="text-neutral-400 text-base font-normal font-mono px-2 py-0.5 bg-neutral-100 rounded-md">
                    {queryMatch.score?.home ?? 0} - {queryMatch.score?.away ?? 0}
                  </span>
                  <span className="text-neutral-800">{queryMatch.teams.away.name}</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
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
          
          {/* Ad inline block */}
          <AdPlaceholder type="sidebar" />

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

          {/* Ad banner inline */}
          <AdPlaceholder type="inline" />

        </div>

      </div>

    </div>
  );
}
