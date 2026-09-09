import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LEAGUES_REGISTRY } from '@/lib/leagues-config';
import Breadcrumbs from '@/components/breadcrumbs';
import { Trophy, ChevronRight, ArrowUpRight, Globe, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Football League Tables & Standings (2026/27) | ZimKickOff',
  description: 'Explore live football league tables, standings, points, and qualification zones for Premier League, La Liga, Champions League, Serie A, and more on ZimKickOff.',
  alternates: {
    canonical: 'https://zimkickoff.co.zw/league'
  },
  openGraph: {
    title: 'Football League Tables & Standings (2026/27) | ZimKickOff',
    description: 'Explore live football league tables and standings for all major global and African competitions on ZimKickOff.',
    url: 'https://zimkickoff.co.zw/league',
    type: 'website'
  }
};

export default function LeaguesHubPage() {
  const featuredLeagues = LEAGUES_REGISTRY.filter(l => l.featured);
  const otherLeagues = LEAGUES_REGISTRY.filter(l => !l.featured);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0d0d0f]">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'League Standings' }
          ]}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-8">
        
        {/* Hub Hero Banner */}
        <div className="bg-white dark:bg-[#141417] rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-6 md:p-8 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-neutral-950 dark:text-white bg-brand-green/20 border border-brand-green/40 px-2 py-0.5 rounded">
                Live Tables Hub
              </span>
              <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                2026/2027 Season
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-black text-neutral-950 dark:text-white tracking-tight">
              Football League Standings & Tables
            </h1>
            <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Explore up-to-date standings, match records, goal differences, and European qualification zones across all top European, African, and international leagues.
            </p>
          </div>
        </div>

        {/* Featured Top Competitions Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-base text-neutral-950 dark:text-white flex items-center gap-2 border-l-3 border-brand-green pl-2.5">
              <span className="w-6 h-6 rounded-md bg-neutral-950 dark:bg-neutral-800 text-brand-green flex items-center justify-center shadow-2xs shrink-0">
                <Trophy className="w-3.5 h-3.5 text-brand-green" />
              </span>
              <span>Featured Competitions</span>
            </h2>
            <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
              {featuredLeagues.length} Major Leagues
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredLeagues.map((league) => (
              <Link
                key={league.slug}
                href={`/league/${league.slug}`}
                className="group bg-white dark:bg-[#141417] p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 hover:border-brand-green/50 dark:hover:border-brand-green/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                      {league.flag}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-neutral-950 dark:group-hover:text-white transition-colors text-sm">
                        {league.name}
                      </h3>
                      <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                        {league.country} • {league.teamCount ? `${league.teamCount} Clubs` : 'Tournament'}
                      </p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white group-hover:bg-neutral-100 dark:group-hover:bg-neutral-700 transition-colors">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  <span>View Official Table</span>
                  <span className="font-mono text-[10px] text-neutral-950 dark:text-white bg-brand-green/20 border border-brand-green/40 px-1.5 py-0.5 rounded font-bold">2026/27</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Additional Global Competitions */}
        {otherLeagues.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800">
            <h2 className="font-display font-extrabold text-base text-neutral-950 dark:text-white flex items-center gap-2 border-l-3 border-brand-green pl-2.5">
              <span className="w-6 h-6 rounded-md bg-neutral-950 dark:bg-neutral-800 text-brand-green flex items-center justify-center shadow-2xs shrink-0">
                <Globe className="w-3.5 h-3.5 text-brand-green" />
              </span>
              <span>More Global Competitions</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {otherLeagues.map((league) => (
                <Link
                  key={league.slug}
                  href={`/league/${league.slug}`}
                  className="group bg-white dark:bg-[#141417] p-4 rounded-xl border border-neutral-200/70 dark:border-neutral-800 hover:border-brand-green/50 dark:hover:border-brand-green/60 shadow-5xs hover:shadow-xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{league.flag}</span>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate group-hover:text-neutral-950 dark:group-hover:text-white transition-colors">
                        {league.name}
                      </h4>
                      <p className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 truncate">
                        {league.country}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
