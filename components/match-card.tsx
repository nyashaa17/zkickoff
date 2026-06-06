'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Match } from '@/lib/matches-data';
import { TeamLogo } from '@/components/team-logo';

interface MatchCardProps {
  match: Match;
}

// Helper to parse kickoff time relative to the current local date
function getKickoffDate(match: Match): Date {
  const now = new Date();
  const dateString = match.dateString || 'Today';
  const kickoffTime = match.kickoffTime || '15:00';
  
  // Parse kickoffTime "HH:MM"
  const [hoursStr, minutesStr] = kickoffTime.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  // 1. If match.esd exists, parse YYYYMMDDHHMMSS format (most reliable)
  if (match.esd && match.esd.length >= 12) {
    const yyyy = parseInt(match.esd.slice(0, 4), 10);
    const mm = parseInt(match.esd.slice(4, 6), 10) - 1; // 0-indexed month
    const dd = parseInt(match.esd.slice(6, 8), 10);
    const hh = parseInt(match.esd.slice(8, 10), 10);
    const min = parseInt(match.esd.slice(10, 12), 10);
    const ss = parseInt(match.esd.slice(12, 14), 10) || 0;
    
    const parsedEsd = new Date(yyyy, mm, dd, hh, min, ss);
    if (!isNaN(parsedEsd.getTime())) {
      return parsedEsd;
    }
  }

  // Fallbacks for mock data or missing esd
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  
  const dsLower = dateString.toLowerCase();
  if (dsLower === 'tomorrow') {
    target.setDate(target.getDate() + 1);
  } else if (dsLower === 'yesterday') {
    target.setDate(target.getDate() - 1);
  } else if (dsLower !== 'today') {
    // Check for DD/MM/YYYY
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const dd = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10) - 1;
        const yyyy = parseInt(parts[2], 10);
        
        const parsedSl = new Date(yyyy, mm, dd, hours, minutes, 0, 0);
        if (!isNaN(parsedSl.getTime())) {
          return parsedSl;
        }
      }
    }
    
    // Check for YYYY-MM-DD
    if (dateString.includes('-')) {
      const parsedDash = new Date(dateString);
      if (!isNaN(parsedDash.getTime())) {
        parsedDash.setHours(hours, minutes, 0, 0);
        return parsedDash;
      }
    }
  }
  
  return target;
}

const MatchCountdown = ({ match }: { match: Match }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>('');

  React.useEffect(() => {
    if (match.status === 'LIVE') {
      return;
    }
    if (match.status === 'FINISHED') {
      return;
    }

    const targetDate = getKickoffDate(match);
    
    function updateTimer() {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Started');
        return;
      }
      
      const secs = Math.floor(diff / 1000) % 60;
      const mins = Math.floor(diff / (1000 * 60)) % 60;
      const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }
    }
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [match]);

  if (match.status === 'LIVE') {
    return (
      <span className="text-[10px] font-bold text-zim-red animate-pulse flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-zim-red inline-block"></span>
        LIVE MATCH
      </span>
    );
  }

  if (match.status === 'FINISHED') {
    return (
      <span className="text-[10px] font-bold text-neutral-400">
        FINISHED
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-neutral-400">Starts in:</span>
      <span className="font-mono font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded-md border border-neutral-200/50 tabular-nums">
        {timeLeft || '00:00'}
      </span>
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
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3 transition-colors hover:border-neutral-300 shadow-sm">
          
          {/* Top Line: League Name & Countdown Timer */}
          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-sans pb-2 border-b border-neutral-100 border-dashed">
            <div className="flex items-center gap-1.5 font-bold tracking-tight truncate max-w-[65%]">
              {match.leagueLogoUrl ? (
                <Image 
                  src={match.leagueLogoUrl} 
                  alt="" 
                  width={14} 
                  height={14} 
                  className="object-contain shrink-0" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 text-[8px] font-bold text-neutral-400 shrink-0">
                  {match.competition.charAt(0)}
                </div>
              )}
              <span className="truncate text-neutral-700 uppercase tracking-wide text-[10px]">{match.competition}</span>
            </div>
            
            <MatchCountdown match={match} />
          </div>

          <div className="flex flex-row items-stretch gap-4">
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
                  <TeamLogo 
                    name={match.teams.home.name} 
                    className="w-6 h-6 md:w-7 md:h-7 shadow-xs border border-neutral-100"
                    bzzBadge={match.teams.home.bzzBadge}
                    lsBadge={match.teams.home.lsBadge}
                  />
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
                  <TeamLogo 
                    name={match.teams.away.name} 
                    className="w-6 h-6 md:w-7 md:h-7 shadow-xs border border-neutral-100"
                    bzzBadge={match.teams.away.bzzBadge}
                    lsBadge={match.teams.away.lsBadge}
                  />
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
          
        </div>
      </Link>
    </motion.div>
  );
}
