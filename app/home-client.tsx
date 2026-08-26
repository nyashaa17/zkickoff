"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
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
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Match } from "@/lib/matches-data";
import MatchCard from "@/components/match-card";
import { MatchGridSkeleton } from "@/components/skeleton-loader";
import HighlightsCarousel from "@/components/highlights-carousel";
import { Highlight } from "@/lib/highlights-service";
import {
  fetchLivescoresDirect,
  fetchStatsDirect,
} from "@/lib/totalsports-client";

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

function HomeContent({ highlights }: { highlights: Highlight[] }) {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("filter");
  const initialTab = searchParams.get("tab") as
    | "LIVE"
    | "TODAY"
    | "UPCOMING"
    | "FINISHED"
    | null;

  const [activeTab, setActiveTab] = useState<
    "LIVE" | "TODAY" | "UPCOMING" | "FINISHED"
  >(initialTab || "TODAY");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [sidebarTab, setSidebarTab] = useState<"STANDINGS" | "STATS">(
    "STANDINGS",
  );
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(
    null,
  );
  const [clientDates, setClientDates] = useState<any[]>([]);

  useEffect(() => {
    const dates: any[] = [];
    const now = new Date();
    const currentDay = now.getDay();
    // Monday of the current week (if Sunday, currentDay is 0, offset by -6 to get previous Monday)
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);

    // Generate 14 continuous days starting from current Monday (covers 2 full weeks: Mon-Sun)
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(diff + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateString = `${yyyy}${mm}${dd}`;

      const isToday =
        yyyy === new Date().getFullYear() &&
        d.getMonth() === new Date().getMonth() &&
        d.getDate() === new Date().getDate();

      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateNumber = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" });

      dates.push({ dateString, dayName, dateNumber, isToday, monthName });
    }
    
    const timer = setTimeout(() => {
      setClientDates(dates);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const fetcher = (url: string) =>
    fetch(url).then((res) => {
      if (!res.ok) throw new Error("Fetch failed");
      return res.json();
    });

  const dateScrollRef = React.useRef<HTMLDivElement>(null);

  const datePickerLabel = React.useMemo(() => {
    if (!selectedDateFilter) return "Pick Date";
    try {
      const yyyy = selectedDateFilter.slice(0, 4);
      const mmStr = selectedDateFilter.slice(4, 6);
      const ddStr = selectedDateFilter.slice(6, 8);
      const dateObj = new Date(
        parseInt(yyyy, 10),
        parseInt(mmStr, 10) - 1,
        parseInt(ddStr, 10)
      );
      return dateObj.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    } catch {
      return "Calendar Date";
    }
  }, [selectedDateFilter]);

  const displayedWeekDates = React.useMemo(() => {
    if (!selectedDateFilter) return clientDates;
    const exists = clientDates.some((d) => d.dateString === selectedDateFilter);
    if (exists) return clientDates;

    const yyyy = selectedDateFilter.slice(0, 4);
    const mmStr = selectedDateFilter.slice(4, 6);
    const ddStr = selectedDateFilter.slice(6, 8);
    const dateObj = new Date(
      parseInt(yyyy, 10),
      parseInt(mmStr, 10) - 1,
      parseInt(ddStr, 10)
    );

    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const dateNumber = dateObj.getDate();
    const monthName = dateObj.toLocaleDateString("en-US", { month: "short" });

    return [
      {
        dateString: selectedDateFilter,
        dayName,
        dateNumber,
        isToday: false,
        monthName,
        isCustom: true,
      },
      ...clientDates,
    ];
  }, [clientDates, selectedDateFilter]);

  useEffect(() => {
    if (dateScrollRef.current) {
      const timer = setTimeout(() => {
        const targetElement =
          dateScrollRef.current?.querySelector('[data-is-selected="true"]') ||
          dateScrollRef.current?.querySelector('[data-is-today="true"]');
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedDateFilter, displayedWeekDates]);

  // Load real scores directly on the client with explicit SWR key tuple mapping:
  // Defaults to today's matches for ultra-fast initial load, loads multi-day schedule on tab change
  const swrKey = selectedDateFilter
    ? ["livescores-direct", selectedDateFilter]
    : activeTab === "UPCOMING"
      ? ["livescores-direct", "all"]
      : ["livescores-direct", "today"];

  const {
    data: livescoreData,
    error: livescoreError,
    isLoading: loading,
  } = useSWR(
    swrKey,
    ([, dateStr]) => fetchLivescoresDirect(dateStr),
    {
      refreshInterval: 25000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const matches = React.useMemo<Match[]>(() => {
    if (livescoreData && livescoreData.matches && !livescoreData.error) {
      return livescoreData.matches;
    }
    return [];
  }, [livescoreData]);

  const isMatchesError = livescoreError || (livescoreData && livescoreData.error);

  // Load player statistics directly on the client to avoid server-side request blocking
  const { data: statsData, isLoading: statsLoading } = useSWR(
    "stats-direct",
    () => fetchStatsDirect(),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  const stats = statsData || [];

  // Load major league standings from API proxy using SWR
  const { data: standingsData, isLoading: standingsLoading } = useSWR(
    `/api/standings?competition=${encodeURIComponent(activeCategory)}`,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  // Handle new response shapes: noLeagueSelected, error object, or plain array
  const standings = Array.isArray(standingsData) ? standingsData : (standingsData?.standings || []);
  const noLeagueSelected = standingsData?.noLeagueSelected === true;

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
      // If a specific date is selected, show all matches for that date ignoring the tab
      const matchesStatus = selectedDateFilter
        ? true
        : match.status === activeTab;

      // 2. League Filter
      if (activeCategory === "ALL") {
        return matchesStatus;
      }
      return matchesStatus && match.competition === activeCategory;
    });
  }, [matches, activeTab, activeCategory, selectedDateFilter]);

  const liveCount = React.useMemo(
    () => matches.filter((m: Match) => m.status === "LIVE").length,
    [matches],
  );
  const todayCount = React.useMemo(
    () => matches.filter((m: Match) => m.status === "TODAY").length,
    [matches],
  );
  const upcomingCount = React.useMemo(
    () => matches.filter((m: Match) => m.status === "UPCOMING").length,
    [matches],
  );
  const finishedCount = React.useMemo(
    () => matches.filter((m: Match) => m.status === "FINISHED").length,
    [matches],
  );

  const majorLeagues = React.useMemo(
    () => [
      "English Premier League",
      "LaLiga",
      "Serie A",
      "Bundesliga",
      "Ligue 1",
      "Champions League",
      "Europa League",
      "ZPSL",
      "Zimbabwe Premier Soccer League",
    ],
    [],
  );

  const tabMatches = React.useMemo(() => {
    return matches.filter((m: Match) =>
      selectedDateFilter ? true : m.status === activeTab,
    );
  }, [matches, activeTab, selectedDateFilter]);

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
    const uniqueLeaguesList = Array.from(
      new Set(tabMatches.map((m: Match) => m.competition as string)),
    ) as string[];
    const sorted = uniqueLeaguesList.sort((a: string, b: string) => {
      const aIsMajor = majorLeagues.some((ml) =>
        a.toLowerCase().includes(ml.toLowerCase()),
      );
      const bIsMajor = majorLeagues.some((ml) =>
        b.toLowerCase().includes(ml.toLowerCase()),
      );
      if (aIsMajor && !bIsMajor) return -1;
      if (!aIsMajor && bIsMajor) return 1;
      return a.localeCompare(b);
    });
    return ["ALL", ...sorted];
  }, [tabMatches, majorLeagues]);

  const groupedTodayMatches = React.useMemo(() => {
    const groups: Record<
      string,
      { leagueName: string; leagueLogoUrl?: string; matches: Match[] }
    > = {};
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

  // Progressive rendering: Load initial batch of ~45 matches / top leagues, load more on scroll
  const INITIAL_RENDER_LIMIT = 45;
  const RENDER_INCREMENT = 45;
  const [renderLimit, setRenderLimit] = useState<number>(INITIAL_RENDER_LIMIT);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement>(null);

  // Reset limit whenever active tab, league category, or date filter changes
  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [activeTab, activeCategory, selectedDateFilter]);

  // Sliced grouped matches based on render limit
  const { visibleGroupedMatches, totalFilteredCount, hasMoreToRender } = React.useMemo(() => {
    let count = 0;
    const groups: typeof groupedTodayMatches = [];
    let hasMore = false;

    for (const group of groupedTodayMatches) {
      if (count < renderLimit) {
        groups.push(group);
        count += group.matches.length;
      } else {
        hasMore = true;
      }
    }

    return {
      visibleGroupedMatches: groups,
      totalFilteredCount: filteredMatches.length,
      hasMoreToRender: hasMore || filteredMatches.length > renderLimit,
    };
  }, [groupedTodayMatches, filteredMatches.length, renderLimit]);

  const visibleFlatMatches = React.useMemo(() => {
    return filteredMatches.slice(0, renderLimit);
  }, [filteredMatches, renderLimit]);

  // IntersectionObserver to automatically load more matches as user scrolls near bottom
  useEffect(() => {
    if (!hasMoreToRender) return;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderLimit((prev) => prev + RENDER_INCREMENT);
        }
      },
      { rootMargin: "600px" }
    );

    observer.observe(sentinel);
    return () => {
      observer.unobserve(sentinel);
    };
  }, [hasMoreToRender, visibleGroupedMatches.length]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      {/* Hero section */}
      <section
        id="hero"
        className="w-full p-6 md:p-10 mb-8 md:mb-12 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        {/* Visual modern grid overlay background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        {/* Decorative dynamic shape representing Zimbabwe warriors shield flare */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-black/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-[#D62828]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 max-w-2xl relative z-10 text-center md:text-left">
          <h1 className="font-display font-extrabold text-3xl md:text-5xl tracking-tight text-neutral-950 leading-tight">
            Watch Live Football <br className="hidden md:inline" /> Matches{" "}
            <span className="text-zim-green underline decoration-zim-yellow decoration-3">
              Free
            </span>
          </h1>
          <p className="text-neutral-500 font-medium text-sm md:text-base max-w-lg">
            Watch Free Live Football Streams In HD No Signup Required Stream
            Premier League UEFA Champions League La Liga And Top Matches
            Worldwide Instantly
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={() => {
                setActiveTab("LIVE");
                document
                  .getElementById("matches-feed")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto cursor-pointer px-5 py-3 bg-zim-green hover:bg-opacity-95 text-white font-display text-xs font-semibold rounded-xl shadow-xs hover:shadow-lg hover:shadow-zim-green/10 flex items-center justify-center gap-2 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Watch Live Streams ({liveCount})
            </button>
            <button
              onClick={() => {
                setActiveTab("TODAY");
                document
                  .getElementById("matches-feed")
                  ?.scrollIntoView({ behavior: "smooth" });
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
            Data compression protocol active to reduce bandwidth usage on mobile
            bundles.
          </p>
        </div>
      </section>

      {/* Match Highlights carousel — server-rendered, hidden if empty */}
      <HighlightsCarousel highlights={highlights} />

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
                  const leagueLogo =
                    league !== "ALL" ? leagueLogoMap[league] : undefined;

                  return (
                    <button
                      key={league}
                      onClick={() => setActiveCategory(league)}
                      className={`shrink-0 cursor-pointer px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-lg font-display tracking-wide transition-all flex items-center gap-1.5 ${
                        activeCategory === league
                          ? "bg-zim-black text-white shadow-xs"
                          : "bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200"
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

            {/* Date Selector Strip with Horizontal Scroll */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-zim-green" />
                    <span className="font-display font-bold text-xs uppercase tracking-wider text-neutral-700">
                      Browse Match Calendar
                    </span>
                  </div>

                  {/* Modern Custom-Styled Calendar Date Picker */}
                  <div className="relative flex items-center">
                    <label id="date-picker-label" className="cursor-pointer flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-zim-green bg-zim-green/5 border border-zim-green/20 rounded-xl hover:bg-zim-green/10 transition-all select-none">
                      <Calendar className="w-3 h-3 text-zim-green" />
                      <span>{datePickerLabel}</span>
                      <input
                        id="date-picker-input"
                        type="date"
                        value={selectedDateFilter ? `${selectedDateFilter.slice(0, 4)}-${selectedDateFilter.slice(4, 6)}-${selectedDateFilter.slice(6, 8)}` : ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            const cleanDate = e.target.value.replace(/-/g, "");
                            setSelectedDateFilter(cleanDate);
                          } else {
                            setSelectedDateFilter(null);
                          }
                        }}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        style={{ colorScheme: "light" }}
                      />
                    </label>
                  </div>
                </div>
                {selectedDateFilter && (
                  <button
                    id="clear-filter-btn"
                    onClick={() => setSelectedDateFilter(null)}
                    className="cursor-pointer text-[10px] font-bold text-zim-red hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg border border-red-100"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              <div className="relative w-full">
                {/* Horizontal scroll container with scroll-snap and customized padding */}
                <div
                  ref={dateScrollRef}
                  className="flex gap-2.5 overflow-x-auto scrollbar-thin pb-2.5 max-w-full snap-x snap-proximity flex-nowrap min-w-full"
                >
                  {displayedWeekDates.map((d) => {
                    const isSelected = selectedDateFilter === d.dateString;
                    return (
                      <button
                        key={d.dateString}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDateFilter(null);
                          } else {
                            setSelectedDateFilter(d.dateString);
                          }
                        }}
                        data-is-selected={isSelected ? "true" : "false"}
                        data-is-today={d.isToday ? "true" : "false"}
                        className={`snap-center shrink-0 flex flex-col items-center justify-center min-w-[70px] h-[78px] rounded-2xl transition-all border duration-200 cursor-pointer ${
                          isSelected
                            ? "bg-zim-green text-white border-zim-green shadow-md shadow-zim-green/20 scale-[1.02] font-semibold"
                            : d.isToday
                              ? "bg-zim-green/5 text-zim-green border-zim-green/30 hover:bg-zim-green/10"
                              : "bg-white hover:bg-neutral-50 text-neutral-600 border-neutral-200/80 hover:border-neutral-300"
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                          {d.isToday ? "Today" : d.dayName}
                        </span>
                        <span className="text-base font-display font-black leading-none my-1">
                          {d.dateNumber}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider opacity-60">
                          {d.monthName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Filter tabs: Live | Today | Upcoming | Finished */}
            {!selectedDateFilter && (
              <div className="flex border-b border-neutral-200/70 p-1 bg-white border border-neutral-200/50 rounded-2xl relative select-none overflow-x-auto scrollbar-thin">
                <button
                  onClick={() => setActiveTab("LIVE")}
                  className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "LIVE"
                      ? "bg-neutral-50 text-zim-red shadow-xs border border-neutral-200"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-zim-red"></span>
                  </span>
                  LIVE NOW ({liveCount})
                </button>

                <button
                  onClick={() => setActiveTab("TODAY")}
                  className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "TODAY"
                      ? "bg-neutral-50 text-zim-green shadow-xs border border-neutral-200"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-zim-yellow" />
                  TODAY ({todayCount})
                </button>

                <button
                  onClick={() => setActiveTab("FINISHED")}
                  className={`flex-1 min-w-[max-content] px-3 py-3 text-[10px] md:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === "FINISHED"
                      ? "bg-neutral-50 text-neutral-800 shadow-xs border border-neutral-200"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  FINISHED ({finishedCount})
                </button>
              </div>
            )}
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
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {isMatchesError ? (
                    <div className="bg-white border border-neutral-200/60 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 my-4 shadow-2xs">
                      <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-display font-bold text-neutral-900 text-sm">
                          Matches unavailable
                        </h4>
                        <p className="text-neutral-500 text-xs">
                          Unable to load matches right now. Please check back shortly.
                        </p>
                      </div>
                    </div>
                  ) : filteredMatches.length > 0 ? (
                    <>
                      {activeTab === "TODAY" || selectedDateFilter !== null ? (
                        // Grouped by league on Today's tab
                        visibleGroupedMatches.map((group) => (
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
                          {visibleFlatMatches.map((match: Match) => (
                            <MatchCard key={match.id} match={match} />
                          ))}
                        </div>
                      )}

                      {/* Progressive load more sentinel & trigger */}
                      {hasMoreToRender && (
                        <div ref={loadMoreSentinelRef} className="pt-2 pb-6 flex flex-col items-center justify-center gap-2">
                          <button
                            onClick={() => setRenderLimit((prev) => prev + RENDER_INCREMENT)}
                            className="cursor-pointer px-5 py-2.5 bg-white hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 rounded-xl text-xs font-display font-semibold transition-all shadow-2xs flex items-center gap-2"
                          >
                            <span>Load More Matches</span>
                            <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                              {Math.max(0, totalFilteredCount - renderLimit)} more
                            </span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white border border-neutral-200/60 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 my-4 shadow-2xs">
                      <div className="w-12 h-12 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-400">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-display font-bold text-neutral-900 text-sm">
                          No matches in this league
                        </h4>
                        <p className="text-neutral-400 text-xs">
                          There are currently no {activeTab.toLowerCase()}{" "}
                          matches listed under{" "}
                          {activeCategory === "ALL" ? "any" : activeCategory}{" "}
                          league. Check back later or view our full schedules.
                        </p>
                      </div>
                      {/* Fallback actions */}
                      {activeCategory !== "ALL" && (
                        <button
                          onClick={() => setActiveCategory("ALL")}
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
                  onClick={() => setSidebarTab("STATS")}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    sidebarTab === "STATS"
                      ? "bg-white text-neutral-900 shadow-3xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  TOP SCORERS
                </button>
                <button
                  onClick={() => setSidebarTab("STANDINGS")}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    sidebarTab === "STANDINGS"
                      ? "bg-white text-neutral-900 shadow-3xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  STANDINGS
                </button>
              </div>
            </div>

            {sidebarTab === "STANDINGS" ? (
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
                          <th className="py-2 text-center font-semibold">
                            Pts
                          </th>
                          <th className="py-2 text-right font-semibold hidden md:table-cell">
                            Form
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {standings.map((team: any) => (
                          <tr
                            key={team.rank}
                            className="hover:bg-neutral-50 transition-colors"
                          >
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
                                      (e.target as HTMLElement).style.display =
                                        "none";
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
                                      f === "W"
                                        ? "bg-black"
                                        : f === "D"
                                          ? "bg-[#FFD100] text-neutral-800"
                                          : "bg-[#D62828]"
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

                    <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-black font-semibold">
                      <span>Major League Standings</span>
                      <Link
                        href="/"
                        className="hover:underline flex items-center gap-0.5"
                      >
                        View Match Feeds &rsaquo;
                      </Link>
                    </div>
                  </>
                ) : noLeagueSelected ? (
                  <div className="text-center py-6 text-neutral-400 text-xs space-y-1">
                    <p className="font-semibold text-neutral-500">Select a league above</p>
                    <p>Pick a specific league to view its standings table.</p>
                  </div>
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
                  stats
                    .slice(0, 1)
                    .map((category: StatCategory, catIdx: number) => (
                      <div key={catIdx} className="space-y-3">
                        <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">
                          {category.title} — English Premier League
                        </p>
                        <div className="divide-y divide-neutral-100">
                          {category.players
                            .slice(0, 5)
                            .map((player: PlayerStat, pIdx: number) => {
                              const badgeUrl = (player as any).logoUrl || null;

                              return (
                                <div
                                  key={pIdx}
                                  className="py-2 flex items-center justify-between text-xs gap-2"
                                >
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
                                          (
                                            e.target as HTMLElement
                                          ).style.display = "none";
                                        }}
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-bold text-neutral-800 truncate">
                                        {player.name}
                                      </p>
                                      <p className="text-[10px] text-neutral-400 font-medium truncate">
                                        {player.teamName}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className="font-mono font-extrabold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-lg">
                                      {Object.values(player.stats)[0]}{" "}
                                      {Object.keys(player.stats)[0] || "Goals"}
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
      
      {/* SEO Section */}
      <section className="mt-12 bg-white rounded-2xl border border-neutral-200/60 p-6 shadow-sm text-center">
        <h2 className="text-xl font-extrabold text-neutral-900 mb-4">Watch Free Football Live Streaming, Score & Fixtures - ZimKickoff</h2>
        <div className="space-y-4 text-sm text-neutral-600 leading-relaxed max-w-3xl mx-auto">
          <p>
            Watch FIFA World Cup 2026, Premier League, LaLiga, UEFA Champions League, Saudi Pro League and more live for free on ZimKickoff. 
          </p>
          <p>
            Get real-time soccer scores, comprehensive stats, schedules, fixtures, and buffer-free live streaming all in one place. No signups required, just instant access to top-tier football matches globally.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function HomeClient({ highlights = [] }: { highlights?: Highlight[] }) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-10">
          <div className="h-10 bg-neutral-200/50 rounded-2xl w-1/4 mb-6 animate-pulse"></div>
          <div className="space-y-4">
            <div className="h-32 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
            <div className="h-32 bg-neutral-200/50 rounded-3xl animate-pulse"></div>
          </div>
        </div>
      }
    >
      <HomeContent highlights={highlights} />
    </Suspense>
  );
}
