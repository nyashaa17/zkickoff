'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Tv, 
  Play, 
  AlertCircle, 
  Home, 
  Calendar, 
  Wifi, 
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match } from '@/lib/matches-data';
import MatchCard from '@/components/match-card';
import { MatchGridSkeleton } from '@/components/skeleton-loader';
import Breadcrumbs from '@/components/breadcrumbs';
import { fetchLivescoresDirect } from '@/lib/totalsports-client';
import dynamic from 'next/dynamic';

const AdsterraBanner = dynamic(
  () => import('@/components/adsterra-banner').then(mod => mod.AdsterraBanner),
  { ssr: false }
);

export default function LivePage() {
  const { data, isLoading: loading, error } = useSWR('livescores-direct', () => fetchLivescoresDirect(), {
    refreshInterval: 25000,
    revalidateOnFocus: true,
  });

  let liveMatches: Match[] = [];
  if (data && data.matches) {
    liveMatches = data.matches.filter((m: Match) => m.status === 'LIVE');
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Live Broadcasts' }]} className="mb-6" />
      
      {/* Header section with live transmission pulse */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200/50 pb-6 mb-8">
        <div className="space-y-1.5 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 bg-red-50 text-zim-red px-2.5 py-1 rounded-full text-xs font-bold border border-red-100 uppercase tracking-widest scale-95 md:scale-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zim-red animate-pulse"></span>
            </span>
            STREAM TRANSMITTING
          </div>
          <h1 className="font-display font-extrabold text-2xl md:text-4xl tracking-tight text-neutral-900 mt-2">
            Active Live Broadcasts
          </h1>
          <p className="text-neutral-500 font-medium text-xs md:text-sm max-w-xl">
            Never miss a goal. Access buffer-free streams optimized specifically for Zimbabwe network configurations. Fast loading, no subscriptions.
          </p>
        </div>

        {/* Status widget box */}
        <div className="bg-white border border-neutral-200/60 p-4 rounded-2xl flex items-center gap-3 w-full md:w-auto shrink-0 shadow-3xs">
          <div className="w-10 h-10 rounded-full bg-green-50 text-zim-green flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5 animate-bounce" />
          </div>
          <div className="text-left font-sans">
            <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">Zim Server Ping</p>
            <p className="text-xs font-bold text-neutral-800">12ms • Status Excellent</p>
          </div>
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Live Grid Center */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <MatchGridSkeleton count={2} />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {liveMatches.length > 0 ? (
                  liveMatches.map((match) => (
                    <motion.div
                      key={match.id}
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <MatchCard match={match} />
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-white border border-neutral-200/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 my-4 shadow-3xs"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#FFFDF4] border border-[#FFE1B5] flex items-center justify-center text-zim-yellow">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5 max-w-md mx-auto">
                      <h3 className="font-display font-extrabold text-neutral-900 text-lg tracking-tight">No Matches Live Streaming Right Now</h3>
                      <p className="text-neutral-500 text-xs leading-relaxed">
                        There are currently no active football kickoffs broadcasting. Standard ZPSL kickoffs take place at 15:00 local harbor time. Please review scheduled fixtures for today.
                      </p>
                    </div>
                    {/* Fast links back list */}
                    <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center w-full max-w-sm">
                      <Link href="/" className="px-5 py-2.5 bg-zim-green hover:bg-opacity-95 text-white font-display text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all">
                        <Home className="w-4 h-4" />
                        View Live Schedules
                      </Link>
                      <Link href="/" className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-1.5 transition-all">
                        <Calendar className="w-4 h-4 text-neutral-400" />
                        Local Matches Today
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <AdsterraBanner />
        </div>

        {/* Right Column: Information & Sponsorship side channels */}
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/60 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="font-display font-bold text-sm text-neutral-950 pb-2 border-b border-neutral-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-zim-green" />
              Latest Football Trends
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-zim-green">ZPSL Update</span>
                <p className="font-semibold text-neutral-800 leading-relaxed">
                  Dynamos vs Highlanders Harare tickets are reported sold out ahead of the weekend derby.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-blue-600">AFCON Qualifiers</span>
                <p className="font-semibold text-neutral-800 leading-relaxed">
                  Warriors captain registers full fitness ahead of Bafana Bafana showdown at Orlando stadium.
                </p>
              </div>
            </div>
          </div>

          <AdsterraBanner />
          {/* Technology stack attribution guidelines */}
          <div className="p-5 border border-dashed border-neutral-200 bg-neutral-50 rounded-3xl space-y-2 text-neutral-500 text-xs">
            <h4 className="font-display font-bold text-neutral-900 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Broadcasting Protocols
            </h4>
            <p className="leading-relaxed">
              We leverage adaptive transport streams (HLS/DASH) proxy protocols to adjust frame resolutions depending on individual subscriber speeds, preserving your data bundles.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
