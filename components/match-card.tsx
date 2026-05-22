'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Match } from '@/lib/matches-data';

interface MatchCardProps {
  match: Match;
}

// Helper to generate a stylized logo letter visualizer without gradients
const TeamBadge = ({ code, logoColor }: { code: string; logoColor: string }) => {
  return (
    <div 
      className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-display font-bold text-white text-[10px] md:text-xs shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] shrink-0"
      style={{ backgroundColor: logoColor }}
    >
      {code}
    </div>
  );
};

export default function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === 'LIVE';
  const isUpcoming = match.status === 'UPCOMING';
  const isToday = match.status === 'TODAY';

  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;
  const showScore = isLive || match.status === 'FINISHED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      id={`match-card-${match.id}`}
      className="group"
    >
      <Link href={`/watch/${match.slug}`} className="block">
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-row items-stretch gap-4 transition-colors hover:border-neutral-300 shadow-sm">
          
          {/* Left Block: Time / Status Info */}
          <div className="flex flex-col items-center justify-center min-w-[64px] shrink-0 border-r border-neutral-100 pr-4 py-1 gap-1.5">
            <span className={`text-[13px] md:text-sm font-medium tracking-tight ${isLive ? 'text-zim-red animate-pulse font-bold' : 'text-neutral-900'}`}>
              {isLive ? (match.eps === 'HT' ? 'HT' : match.minute ? `${match.minute}'` : match.eps && match.eps !== 'NS' ? match.eps : 'LIVE') : match.status === 'FINISHED' ? (match.eps || 'FT') : match.kickoffTime}
            </span>
            <div className={`px-1.5 py-0.5 text-[10px] font-medium border rounded w-full max-w-[50px] flex items-center justify-center text-center ${
              isLive 
                ? 'border-red-100 text-zim-red bg-red-50' 
                : match.status === 'FINISHED'
                ? 'border-neutral-200 text-neutral-600 bg-neutral-100'
                : 'border-neutral-200 text-neutral-600 bg-neutral-50'
            }`}>
              {isLive ? 'LIVE' : match.status === 'FINISHED' ? 'ENDED' : isToday ? 'TODAY' : match.dateString?.split(' ')[0] || 'TBD'}
            </div>
          </div>

          {/* Right Block: Stacked Teams */}
          <div className="flex-1 flex flex-col justify-between py-0.5 gap-3">
            {/* Home Team Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamBadge code={match.teams.home.code} logoColor={match.teams.home.logoColor} />
                <span className="text-[15px] md:text-base font-semibold text-neutral-800">
                  {match.teams.home.name}
                </span>
              </div>
              <span className={`text-[15px] md:text-base font-bold tabular-nums ${showScore ? 'text-neutral-900' : 'text-neutral-300'}`}>
                {showScore ? homeScore : '-'}
              </span>
            </div>

            {/* Away Team Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamBadge code={match.teams.away.code} logoColor={match.teams.away.logoColor} />
                <span className="text-[15px] md:text-base font-semibold text-neutral-800">
                  {match.teams.away.name}
                </span>
              </div>
              <span className={`text-[15px] md:text-base font-bold tabular-nums ${showScore ? 'text-neutral-900' : 'text-neutral-300'}`}>
                {showScore ? awayScore : '-'}
              </span>
            </div>
          </div>
          
        </div>
      </Link>
    </motion.div>
  );
}
