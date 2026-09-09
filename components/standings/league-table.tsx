'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LeagueConfig, getZoneForRule, LeagueZoneRule } from '@/lib/leagues-config';
import { StandingsRow } from '@/lib/standings-service';
import { TeamLogo } from '@/components/team-logo';
import { Sparkles, Trophy, Info, Flame, ShieldAlert, BarChart2 } from 'lucide-react';

interface LeagueTableProps {
  league: LeagueConfig;
  standings?: StandingsRow[];
  groups?: Record<string, StandingsRow[]>;
  isGrouped?: boolean;
  seasonName?: string;
}

export function LeagueTable({
  league,
  standings = [],
  groups,
  isGrouped = false,
  seasonName
}: LeagueTableProps) {
  const [showAdvancedXG, setShowAdvancedXG] = useState(false);

  // Grouped Tournament View
  if (isGrouped && groups && Object.keys(groups).length > 0) {
    return (
      <div className="space-y-8">
        {Object.entries(groups).map(([groupName, groupRows]) => (
          <div key={groupName} className="bg-white dark:bg-[#141417] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs overflow-hidden">
            <div className="bg-neutral-50/80 dark:bg-neutral-900/60 px-5 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between border-l-3 border-brand-green">
              <h3 className="font-display font-extrabold text-sm text-neutral-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-neutral-950 dark:bg-neutral-800 text-brand-green flex items-center justify-center shadow-2xs shrink-0">
                  <Trophy className="w-3 h-3 text-brand-green" />
                </span>
                <span>{groupName}</span>
              </h3>
              <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                Top 2 Qualify
              </span>
            </div>

            <TableGrid
              league={league}
              rows={groupRows}
              showAdvancedXG={showAdvancedXG}
            />
          </div>
        ))}

        <ZoneLegend league={league} />
      </div>
    );
  }

  // Empty state handling
  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141417] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-8 md:p-12 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 bg-neutral-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto border border-neutral-200 dark:border-neutral-700 text-neutral-400">
          <Trophy className="w-7 h-7 text-neutral-800 dark:text-neutral-200" />
        </div>
        <div className="space-y-1.5 max-w-md mx-auto">
          <h3 className="font-display font-extrabold text-neutral-900 dark:text-white text-base">
            {seasonName ? `${seasonName} Standings Updating` : 'Standings Coming Soon'}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            The {league.name} standings table will populate automatically as upcoming fixture results and points are recorded.
          </p>
        </div>
      </div>
    );
  }

  // Flat Single League Table View
  return (
    <div className="space-y-4">
      {/* Table Controls (xG toggle) */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
          Showing <span className="font-bold text-neutral-800 dark:text-neutral-200">{standings.length}</span> clubs • {seasonName || '2026/2027 Season'}
        </div>

        <button
          onClick={() => setShowAdvancedXG(!showAdvancedXG)}
          className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition-all border ${
            showAdvancedXG
              ? 'bg-brand-green text-neutral-950 border-brand-green shadow-xs'
              : 'bg-white dark:bg-[#141417] text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>{showAdvancedXG ? 'Standard View' : 'Show xG Stats'}</span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#141417] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs overflow-hidden">
        <TableGrid
          league={league}
          rows={standings}
          showAdvancedXG={showAdvancedXG}
        />
      </div>

      {/* Per-League Zone Legend Footer */}
      <ZoneLegend league={league} />
    </div>
  );
}

interface TableGridProps {
  league: LeagueConfig;
  rows: StandingsRow[];
  showAdvancedXG: boolean;
}

function TableGrid({ league, rows, showAdvancedXG }: TableGridProps) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-left text-xs border-collapse select-none">
        <thead>
          <tr className="bg-neutral-50/90 dark:bg-[#18181b] text-[10px] font-mono font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider border-b border-neutral-200/80 dark:border-neutral-800">
            <th className="py-3 px-3 w-10 text-center">Pos</th>
            <th className="py-3 px-3 min-w-[170px] md:min-w-[220px]">Club</th>
            <th className="py-3 px-2.5 text-center font-extrabold text-neutral-700 dark:text-neutral-300">PL</th>
            <th className="py-3 px-2 text-center">W</th>
            <th className="py-3 px-2 text-center">D</th>
            <th className="py-3 px-2 text-center">L</th>
            <th className="py-3 px-2 text-center hidden sm:table-cell">GF</th>
            <th className="py-3 px-2 text-center hidden sm:table-cell">GA</th>
            <th className="py-3 px-2.5 text-center font-bold text-neutral-700 dark:text-neutral-300">GD</th>
            {showAdvancedXG && (
              <>
                <th className="py-3 px-2 text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40">xGF</th>
                <th className="py-3 px-2 text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40">xGA</th>
                <th className="py-3 px-2 text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40">xGD</th>
              </>
            )}
            <th className="py-3 px-3 text-center font-black text-neutral-900 dark:text-white bg-neutral-100/60 dark:bg-neutral-800/60">PTS</th>
            <th className="py-3 px-3 text-center hidden md:table-cell min-w-[120px]">Recent Form</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((row) => {
            const zone = getZoneForRule(league, row.position);
            const parsedForm = typeof row.form === 'string'
              ? row.form.trim().split('').slice(-5)
              : Array.isArray(row.form) ? row.form.slice(-5) : [];

            return (
              <tr
                key={row.team_id || row.position}
                className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors group ${
                  row.live ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''
                }`}
              >
                {/* 1. Position with Zone Left Border */}
                <td className="py-3 px-2 text-center relative font-mono text-xs">
                  {zone && (
                    <span
                      className={`absolute left-0 top-1 bottom-1 w-1 rounded-r-sm ${
                        zone.colorType === 'ucl'
                          ? 'bg-blue-500'
                          : zone.colorType === 'promo'
                            ? 'bg-emerald-500'
                            : zone.colorType === 'uel'
                              ? 'bg-amber-500'
                              : zone.colorType === 'uecl' || zone.colorType === 'qual'
                                ? 'bg-purple-500'
                                : zone.colorType === 'playoff'
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                      }`}
                    />
                  )}
                  <span className={`font-extrabold ${row.position <= 4 ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {row.position}
                  </span>
                </td>

                {/* 2. Team Name & Logo */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TeamLogo
                      name={row.team_name}
                      bzzBadge={row.team_id ? `https://sports.bzzoiro.com/img/team/${row.team_id}` : undefined}
                      className="w-5 h-5 shrink-0"
                    />
                    <span className="font-display font-bold text-neutral-900 dark:text-neutral-100 truncate text-xs group-hover:text-[#009739] dark:group-hover:text-brand-green transition-colors">
                      {row.team_name}
                    </span>
                    {row.live && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Match Live" />
                    )}
                  </div>
                </td>

                {/* 3. Played */}
                <td className="py-3 px-2.5 text-center font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {row.played}
                </td>

                {/* 4. Won */}
                <td className="py-3 px-2 text-center font-mono text-neutral-600 dark:text-neutral-400">
                  {row.won}
                </td>

                {/* 5. Drawn */}
                <td className="py-3 px-2 text-center font-mono text-neutral-600 dark:text-neutral-400">
                  {row.drawn}
                </td>

                {/* 6. Lost */}
                <td className="py-3 px-2 text-center font-mono text-neutral-600 dark:text-neutral-400">
                  {row.lost}
                </td>

                {/* 7. GF */}
                <td className="py-3 px-2 text-center font-mono text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">
                  {row.gf}
                </td>

                {/* 8. GA */}
                <td className="py-3 px-2 text-center font-mono text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">
                  {row.ga}
                </td>

                {/* 9. GD */}
                <td className="py-3 px-2.5 text-center font-mono font-bold text-neutral-700 dark:text-neutral-300">
                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                </td>

                {/* Optional xG metrics */}
                {showAdvancedXG && (
                  <>
                    <td className="py-3 px-2 text-center font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/20">
                      {row.xgf !== undefined ? Number(row.xgf).toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50/20 dark:bg-indigo-950/20">
                      {row.xga !== undefined ? Number(row.xga).toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-indigo-800 dark:text-indigo-200 bg-indigo-50/20 dark:bg-indigo-950/20">
                      {row.xgd !== undefined ? (Number(row.xgd) > 0 ? `+${Number(row.xgd).toFixed(1)}` : Number(row.xgd).toFixed(1)) : '-'}
                    </td>
                  </>
                )}

                {/* 10. Points */}
                <td className="py-3 px-3 text-center font-mono font-black text-sm text-neutral-950 dark:text-white bg-neutral-50/60 dark:bg-neutral-800/40">
                  {row.pts}
                </td>

                {/* 11. Form Badges */}
                <td className="py-3 px-3 hidden md:table-cell">
                  <div className="flex items-center justify-center gap-1">
                    {parsedForm.length > 0 ? (
                      parsedForm.map((f, fIdx) => {
                        const letter = f.toUpperCase();
                        const isWin = letter === 'W';
                        const isDraw = letter === 'D';
                        const isLoss = letter === 'L';

                        return (
                          <span
                            key={fIdx}
                            className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-mono font-black shadow-3xs ${
                              isWin
                                ? 'bg-emerald-600 text-white'
                                : isDraw
                                  ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
                                  : isLoss
                                    ? 'bg-red-500 text-white'
                                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            {letter}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">-</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ZoneLegend({ league }: { league: LeagueConfig }) {
  if (!league.zones || league.zones.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#141417] rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-4 shadow-xs space-y-2">
      <h4 className="text-[10px] font-mono font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
        Qualification & Relegation Rules
      </h4>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {league.zones.map((zone, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                zone.colorType === 'ucl'
                  ? 'bg-blue-500'
                  : zone.colorType === 'promo'
                    ? 'bg-emerald-500'
                    : zone.colorType === 'uel'
                      ? 'bg-amber-500'
                      : zone.colorType === 'uecl' || zone.colorType === 'qual'
                        ? 'bg-purple-500'
                        : zone.colorType === 'playoff'
                          ? 'bg-orange-500'
                          : 'bg-red-500'
              }`}
            />
            <span className="text-neutral-700 dark:text-neutral-300 font-medium">
              <strong className="text-neutral-900 dark:text-white font-bold">{zone.range[0]}{zone.range[0] !== zone.range[1] ? `–${zone.range[1]}` : ''}:</strong> {zone.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
