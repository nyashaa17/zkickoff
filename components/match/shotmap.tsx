'use client';

import React, { useState } from 'react';
import { Target, Sparkles, Info, ShieldCheck, Flame } from 'lucide-react';
import { TeamLogo } from '@/components/team-logo';

export interface ShotmapItem {
  pos?: { x: number; y: number; z?: number };
  xg?: number;
  min?: number;
  home?: boolean;
  type?: 'goal' | 'save' | 'miss' | 'block' | 'post' | string;
  sit?: string;
  body?: string;
  player_id?: number;
  player_name?: string;
  gml?: string;
  gtype?: string;
}

interface ShotmapProps {
  shotmap?: ShotmapItem[];
  homeTeamName: string;
  awayTeamName: string;
  isUpcoming?: boolean;
  isLoading?: boolean;
}

export function Shotmap({
  shotmap = [],
  homeTeamName,
  awayTeamName,
  isUpcoming = false,
  isLoading = false
}: ShotmapProps) {
  const [selectedTeam, setSelectedTeam] = useState<'ALL' | 'HOME' | 'AWAY'>('ALL');
  const [hoveredShot, setHoveredShot] = useState<ShotmapItem | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-neutral-100 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  // Filter shots
  const filteredShots = shotmap.filter((shot) => {
    if (selectedTeam === 'HOME') return shot.home === true;
    if (selectedTeam === 'AWAY') return shot.home === false;
    return true;
  });

  // Calculate totals
  const homeShots = shotmap.filter((s) => s.home === true);
  const awayShots = shotmap.filter((s) => s.home === false);

  const homeXG = homeShots.reduce((acc, s) => acc + (s.xg || 0), 0);
  const awayXG = awayShots.reduce((acc, s) => acc + (s.xg || 0), 0);

  const homeOnTarget = homeShots.filter((s) => s.type === 'goal' || s.type === 'save').length;
  const awayOnTarget = awayShots.filter((s) => s.type === 'goal' || s.type === 'save').length;

  const homeGoals = homeShots.filter((s) => s.type === 'goal').length;
  const awayGoals = awayShots.filter((s) => s.type === 'goal').length;

  // Empty state handling
  if (!shotmap || shotmap.length === 0) {
    return (
      <div className="py-12 px-4 text-center space-y-3 bg-neutral-50/70 rounded-2xl border border-neutral-200/50">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto shadow-xs border border-neutral-200 text-neutral-400">
          <Target className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-display font-bold text-neutral-800 text-sm">
            {isUpcoming ? 'Shotmap Activates at Kickoff' : 'Shotmap Data Not Available'}
          </h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {isUpcoming
              ? 'Interactive shot locations, xG values, and goal trajectories will update live here as the match progresses.'
              : 'Detailed shot position coordinates are not covered for this competition.'}
          </p>
        </div>
      </div>
    );
  }

  const getShotColor = (type?: string, isGoal?: boolean) => {
    if (isGoal || type === 'goal') return '#009739'; // Goal - Green
    if (type === 'save') return '#2563eb'; // Saved - Blue
    if (type === 'block') return '#f59e0b'; // Blocked - Amber
    if (type === 'post') return '#8b5cf6'; // Post - Violet
    return '#94a3b8'; // Miss - Slate Gray
  };

  const getShotLabel = (type?: string) => {
    switch (type) {
      case 'goal': return 'Goal';
      case 'save': return 'Saved';
      case 'block': return 'Blocked';
      case 'post': return 'Woodwork';
      case 'miss': return 'Off Target';
      default: return type || 'Shot';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls: Team Selector & xG Scorecard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="font-display font-extrabold text-sm text-neutral-950 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-[#009739]" />
            <span>Interactive Pitch Shotmap</span>
          </h3>
          <p className="text-[11px] text-neutral-500">
            Shot locations, expected goals (xG), and outcomes.
          </p>
        </div>

        {/* Team filter pills */}
        <div className="flex bg-neutral-100 p-0.5 rounded-xl text-xs font-bold shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setSelectedTeam('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedTeam === 'ALL'
                ? 'bg-white text-neutral-900 shadow-3xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            All ({shotmap.length})
          </button>
          <button
            onClick={() => setSelectedTeam('HOME')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedTeam === 'HOME'
                ? 'bg-white text-[#009739] shadow-3xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {homeTeamName.slice(0, 10)} ({homeShots.length})
          </button>
          <button
            onClick={() => setSelectedTeam('AWAY')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedTeam === 'AWAY'
                ? 'bg-white text-red-600 shadow-3xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {awayTeamName.slice(0, 10)} ({awayShots.length})
          </button>
        </div>
      </div>

      {/* Quick metrics comparison strip */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-0.5">
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Total xG</span>
          <div className="flex items-center justify-center gap-2 font-mono font-extrabold text-sm text-neutral-900">
            <span className="text-[#009739]">{homeXG.toFixed(2)}</span>
            <span className="text-neutral-300">vs</span>
            <span className="text-red-600">{awayXG.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-0.5">
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Shots (Target)</span>
          <div className="flex items-center justify-center gap-2 font-mono font-extrabold text-sm text-neutral-900">
            <span>{homeShots.length} ({homeOnTarget})</span>
            <span className="text-neutral-300">vs</span>
            <span>{awayShots.length} ({awayOnTarget})</span>
          </div>
        </div>

        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/40 space-y-0.5">
          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Goals</span>
          <div className="flex items-center justify-center gap-2 font-mono font-extrabold text-sm text-neutral-900">
            <span className="text-[#009739]">{homeGoals}</span>
            <span className="text-neutral-300">-</span>
            <span className="text-red-600">{awayGoals}</span>
          </div>
        </div>
      </div>

      {/* SVG Attack Pitch Diagram */}
      <div className="relative w-full aspect-[16/11] max-w-2xl mx-auto bg-[#1A472A] rounded-2xl overflow-hidden shadow-inner border-2 border-[#2D6A4F] select-none">
        {/* Grass stripe pattern */}
        <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-black/20' : 'bg-transparent'}`} />
          ))}
        </div>

        <svg
          viewBox="0 0 100 68"
          className="w-full h-full text-white/40 fill-none stroke-current stroke-[0.8]"
        >
          {/* Pitch Outer Boundary (Attacking Half) */}
          <rect x="5" y="4" width="90" height="60" strokeWidth="1" />

          {/* Halfway Line */}
          <line x1="5" y1="64" x2="95" y2="64" strokeWidth="1" />
          {/* Center Circle Arc */}
          <path d="M 40 64 A 10 10 0 0 1 60 64" strokeWidth="0.8" />

          {/* Goal Box (Top) */}
          <rect x="44" y="2" width="12" height="2" strokeWidth="1.2" className="stroke-white/80" />

          {/* 6-Yard Box */}
          <rect x="36" y="4" width="28" height="8" strokeWidth="0.8" />

          {/* 18-Yard Penalty Area */}
          <rect x="22" y="4" width="56" height="20" strokeWidth="0.8" />

          {/* Penalty Spot */}
          <circle cx="50" cy="16" r="0.8" fill="white" className="fill-white/60" />

          {/* Penalty Arc */}
          <path d="M 41 24 A 9 9 0 0 0 59 24" strokeWidth="0.8" />

          {/* Goal Line Indicator */}
          <line x1="44" y1="4" x2="56" y2="4" strokeWidth="1.5" className="stroke-white" />

          {/* Shot Markers */}
          {filteredShots.map((shot, idx) => {
            // Coordinate mapping: pos.y is width 0-100%, pos.x is distance from goal (0-35m)
            const rawY = typeof shot.pos?.y === 'number' ? shot.pos.y : 50;
            const rawX = typeof shot.pos?.x === 'number' ? shot.pos.x : 15;

            // Constrain within pitch coordinates
            const cx = Math.max(8, Math.min(92, 5 + (rawY * 0.9)));
            const cy = Math.max(6, Math.min(60, 4 + (rawX * 1.35)));

            const radius = Math.max(1.8, Math.min(4.5, 1.8 + (shot.xg || 0.05) * 3.5));
            const isGoal = shot.type === 'goal';
            const color = getShotColor(shot.type, isGoal);
            const isHovered = hoveredShot === shot;

            return (
              <g
                key={idx}
                className="cursor-pointer transition-transform duration-150 group"
                onMouseEnter={() => setHoveredShot(shot)}
                onMouseLeave={() => setHoveredShot(null)}
                onClick={() => setHoveredShot(shot)}
              >
                {/* Outer Glow for Goals or Hovered */}
                {isGoal && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 1.8}
                    fill="none"
                    stroke="#FFD100"
                    strokeWidth="0.8"
                    className="animate-pulse"
                  />
                )}

                {/* Main Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={color}
                  stroke={isHovered ? '#FFFFFF' : '#0B1E13'}
                  strokeWidth={isHovered ? '1' : '0.6'}
                  className="transition-all"
                />

                {/* Star icon badge on goal */}
                {isGoal && (
                  <text
                    x={cx}
                    y={cy + 0.6}
                    fontSize="2.2"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontWeight="bold"
                  >
                    ★
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Goal Indicator Label at top */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black/40 text-white/80 text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider backdrop-blur-xs pointer-events-none">
          Goal Target
        </div>

        {/* Interactive Tooltip Card Overlay */}
        {hoveredShot && (
          <div className="absolute bottom-3 left-3 right-3 bg-neutral-900/95 backdrop-blur-md text-white p-3 rounded-xl border border-neutral-700 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getShotColor(hoveredShot.type, hoveredShot.type === 'goal') }}
                />
                <strong className="text-xs font-display font-extrabold uppercase">
                  {getShotLabel(hoveredShot.type)}
                </strong>
                <span className="text-[10px] font-mono text-neutral-400">
                  {hoveredShot.min}&apos; minute
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${hoveredShot.home ? 'bg-[#009739]/30 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                  {hoveredShot.home ? homeTeamName : awayTeamName}
                </span>
              </div>

              <div className="text-[11px] text-neutral-300 flex items-center gap-3">
                <span>Situation: <span className="text-white capitalize">{hoveredShot.sit || 'Open Play'}</span></span>
                {hoveredShot.body && <span>Body: <span className="text-white capitalize">{hoveredShot.body}</span></span>}
              </div>
            </div>

            <div className="text-right shrink-0 bg-neutral-800/80 px-2.5 py-1 rounded-lg border border-neutral-700 font-mono">
              <span className="text-[9px] text-neutral-400 block uppercase">Expected Goal</span>
              <strong className="text-xs text-[#FFD100] font-black">
                {((hoveredShot.xg || 0) * 100).toFixed(1)}% xG
              </strong>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Guidance Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200/40 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#009739] border border-black/20 flex items-center justify-center text-[7px] text-white">★</span>
            <span className="text-neutral-700 font-medium">Goal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
            <span className="text-neutral-700 font-medium">Saved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="text-neutral-700 font-medium">Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
            <span className="text-neutral-700 font-medium">Off Target</span>
          </div>
        </div>

        <div className="text-[11px] text-neutral-500 font-mono">
          Circle size proportional to xG probability
        </div>
      </div>
    </div>
  );
}
