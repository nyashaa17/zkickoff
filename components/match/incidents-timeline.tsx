'use client';

import React from 'react';
import { 
  Flame, 
  ArrowRightLeft, 
  Tv, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { TeamLogo } from '@/components/team-logo';

export interface MatchIncident {
  type?: 'goal' | 'card' | 'substitution' | 'varDecision' | 'period' | 'injuryTime' | string;
  minute?: number;
  added_time?: number | null;
  period_second?: number;
  is_home?: boolean;
  player?: string;
  player_id?: number | null;
  player_in?: string;
  player_in_id?: number | null;
  player_out?: string;
  player_out_id?: number | null;
  card_type?: 'yellow' | 'red' | 'yellow_red' | string;
  goal_type?: 'regular' | 'penalty' | 'own_goal' | 'own-goal' | string;
  assist?: string;
  assist_id?: number | null;
  home_score?: number;
  away_score?: number;
  text?: string;
  rescinded?: boolean;
  length?: number;
  var_reason?: string;
  var_result?: string;
}

interface IncidentsTimelineProps {
  incidents?: MatchIncident[];
  homeTeamName: string;
  awayTeamName: string;
  isUpcoming?: boolean;
  isLoading?: boolean;
}

export function IncidentsTimeline({
  incidents = [],
  homeTeamName,
  awayTeamName,
  isUpcoming = false,
  isLoading = false
}: IncidentsTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // Graceful empty state
  if (!incidents || incidents.length === 0) {
    return (
      <div className="py-12 px-4 text-center space-y-3 bg-neutral-50/70 rounded-2xl border border-neutral-200/50">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-xs border border-neutral-200 text-neutral-400">
          <Clock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-display font-bold text-neutral-800 text-sm">
            {isUpcoming ? 'Timeline Activates at Kickoff' : 'No Match Incidents Recorded'}
          </h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {isUpcoming
              ? 'Key match incidents including goals, cards, substitutions, and VAR reviews will stream here in real-time.'
              : 'Detailed incident log is not available for this event.'}
          </p>
        </div>
      </div>
    );
  }

  // Sort incidents chronologically: minute, then added_time, then period_second
  const sortedIncidents = [...incidents].sort((a, b) => {
    const minA = a.minute ?? 0;
    const minB = b.minute ?? 0;
    if (minA !== minB) return minA - minB;

    const addA = a.added_time ?? 0;
    const addB = b.added_time ?? 0;
    if (addA !== addB) return addA - addB;

    const secA = a.period_second ?? 0;
    const secB = b.period_second ?? 0;
    return secA - secB;
  });

  // Calculate incident summary stats
  const activeCards = sortedIncidents.filter(i => i.type === 'card' && !i.rescinded);
  const homeYellows = activeCards.filter(i => i.is_home && (i.card_type === 'yellow' || !i.card_type)).length;
  const awayYellows = activeCards.filter(i => !i.is_home && (i.card_type === 'yellow' || !i.card_type)).length;
  const homeReds = activeCards.filter(i => i.is_home && (i.card_type === 'red' || i.card_type === 'yellow_red')).length;
  const awayReds = activeCards.filter(i => !i.is_home && (i.card_type === 'red' || i.card_type === 'yellow_red')).length;

  return (
    <div className="space-y-6">
      {/* Header & Match Discipline Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#009739]" />
            <span>Match Incidents Timeline</span>
          </h3>
          <p className="text-[11px] text-neutral-500">
            Chronological log of goals, disciplinary cards, substitutions, and VAR reviews.
          </p>
        </div>

        {/* Discipline pill badges */}
        <div className="flex items-center gap-3 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200/50 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-3.5 bg-amber-400 rounded-xs shadow-3xs" />
            <span className="font-bold">{homeYellows} - {awayYellows}</span>
          </div>
          <div className="h-3 w-px bg-neutral-200" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-3.5 bg-red-600 rounded-xs shadow-3xs" />
            <span className="font-bold">{homeReds} - {awayReds}</span>
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="relative border-l-2 border-neutral-200/80 ml-4 pl-6 space-y-6 py-2">
        {sortedIncidents.map((incident, idx) => {
          const minuteDisplay = `${incident.minute || 0}${incident.added_time ? `+${incident.added_time}` : ''}'`;

          // Period markers (HT / FT / Period)
          if (incident.type === 'period') {
            const isFT = incident.text?.includes('FT') || (incident.minute && incident.minute >= 90);
            return (
              <div key={idx} className="relative -ml-9 flex items-center gap-3 my-4">
                <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center font-mono font-bold text-[10px] shadow-sm">
                  {incident.text || (isFT ? 'FT' : 'HT')}
                </div>
                <div className="bg-neutral-100 text-neutral-800 font-display font-extrabold text-xs px-3 py-1 rounded-full border border-neutral-200/60 shadow-4xs">
                  {incident.text === 'HT' ? 'Half Time' : incident.text === 'FT' ? 'Full Time' : incident.text || 'Period End'}
                  {incident.home_score !== undefined && incident.away_score !== undefined && (
                    <span className="ml-2 font-mono text-[#009739]">
                      ({incident.home_score} - {incident.away_score})
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Injury time announcement
          if (incident.type === 'injuryTime') {
            return (
              <div key={idx} className="relative -ml-8 flex items-center gap-2 text-[11px] text-neutral-500 font-mono italic">
                <div className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-bold">
                  +
                </div>
                <span>+{incident.length || incident.minute || 0} minutes stoppage time indicated</span>
              </div>
            );
          }

          // Main events (Goal, Card, Substitution, VAR)
          const isHome = incident.is_home !== false;
          const teamName = isHome ? homeTeamName : awayTeamName;

          return (
            <div key={idx} className="relative group">
              {/* Timeline marker node */}
              <div
                className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center text-[8px] font-bold ${
                  incident.type === 'goal'
                    ? 'bg-[#009739] text-white ring-2 ring-emerald-300 animate-pulse'
                    : incident.type === 'card'
                      ? incident.card_type === 'red' || incident.card_type === 'yellow_red'
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-400 text-neutral-950'
                      : incident.type === 'substitution'
                        ? 'bg-blue-600 text-white'
                        : incident.type === 'varDecision'
                          ? 'bg-purple-600 text-white'
                          : 'bg-neutral-400 text-white'
                }`}
              >
                {incident.type === 'goal' ? '⚽' : ''}
              </div>

              {/* Event Card */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                incident.rescinded
                  ? 'bg-neutral-50 border-neutral-200/50 opacity-60'
                  : incident.type === 'goal'
                    ? 'bg-emerald-50/70 border-emerald-200 shadow-4xs'
                    : 'bg-white border-neutral-200/70 hover:border-neutral-300 shadow-5xs'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  
                  {/* Left: Type Badge & Minute */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200/50">
                      {minuteDisplay}
                    </span>

                    {/* Team indicator badge */}
                    <div className="flex items-center gap-1.5 text-xs font-bold font-display">
                      <TeamLogo name={teamName} className="w-4 h-4" />
                      <span className={isHome ? 'text-neutral-900' : 'text-neutral-700'}>
                        {teamName}
                      </span>
                    </div>
                  </div>

                  {/* Right: Score progression if goal */}
                  {incident.type === 'goal' && (
                    <div className="font-mono font-black text-sm bg-emerald-600 text-white px-2.5 py-0.5 rounded-lg shadow-xs">
                      {incident.home_score ?? 0} - {incident.away_score ?? 0}
                    </div>
                  )}
                </div>

                {/* Event Body Details */}
                <div className="mt-2 text-xs">
                  {/* 1. GOAL INCIDENT */}
                  {incident.type === 'goal' && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚽</span>
                        <strong className="font-display font-extrabold text-neutral-950 text-sm">
                          {incident.player || 'Goal'}
                        </strong>
                        {incident.goal_type && incident.goal_type !== 'regular' && (
                          <span className="font-mono text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded uppercase">
                            {incident.goal_type === 'penalty' ? 'Penalty' : 'Own Goal'}
                          </span>
                        )}
                      </div>
                      {incident.assist && (
                        <p className="text-[11px] text-neutral-600 ml-6">
                          Assist: <span className="font-semibold text-neutral-800">{incident.assist}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* 2. CARD INCIDENT */}
                  {incident.type === 'card' && (
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-4 rounded-xs shrink-0 shadow-3xs ${
                        incident.card_type === 'red' || incident.card_type === 'yellow_red'
                          ? 'bg-red-600'
                          : 'bg-amber-400'
                      }`} />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <strong className={`font-display font-bold ${incident.rescinded ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                            {incident.player || 'Player'}
                          </strong>
                          <span className="font-mono text-[10px] text-neutral-500 uppercase">
                            {incident.card_type === 'red' ? 'Red Card' : incident.card_type === 'yellow_red' ? 'Second Yellow (Red)' : 'Yellow Card'}
                          </span>
                          {incident.rescinded && (
                            <span className="bg-red-100 text-red-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                              Rescinded by VAR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. SUBSTITUTION INCIDENT */}
                  {incident.type === 'substitution' && (
                    <div className="flex items-center gap-2.5">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[11px]">
                        <span className="font-semibold text-emerald-700 flex items-center gap-1">
                          ▲ <span className="underline decoration-emerald-300">{incident.player_in || 'Player In'}</span>
                        </span>
                        <span className="text-neutral-400 hidden sm:inline">•</span>
                        <span className="text-neutral-500 flex items-center gap-1">
                          ▼ <span className="line-through decoration-neutral-400">{incident.player_out || 'Player Out'}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 4. VAR DECISION */}
                  {incident.type === 'varDecision' && (
                    <div className="p-2 bg-purple-50 rounded-lg border border-purple-100 flex items-center gap-2 text-purple-900">
                      <Tv className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="space-y-0.5">
                        <div className="font-display font-extrabold text-[11px] uppercase tracking-wide">
                          VAR Review: {incident.player || incident.text || 'Decision Confirmed'}
                        </div>
                        {incident.var_reason && (
                          <p className="text-[10px] text-purple-700">{incident.var_reason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
