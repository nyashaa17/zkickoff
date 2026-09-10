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
    <div className="min-h-screen bg-[#F8FAFC]">
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
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 md:p-8 shadow-xs relative overflow-hidden">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-[#009739] bg-[#009739]/10 px-2 py-0.5 rounded">
                Live Tables Hub
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                2026/2027 Season
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-black text-neutral-950 tracking-tight">
              Football League Standings & Tables
            </h1>
            <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
              Explore up-to-date standings, match records, goal differences, and European qualification zones across all top European, African, and international leagues.
            </p>
          </div>
        </div>

        {/* Featured Top Competitions Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-base text-neutral-950 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#009739]" />
              <span>Featured Competitions</span>
            </h2>
            <span className="text-[11px] font-mono text-neutral-400">
              {featuredLeagues.length} Major Leagues
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredLeagues.map((league) => (
              <Link
                key={league.slug}
                href={`/league/${league.slug}`}
                className="group bg-white p-5 rounded-2xl border border-neutral-200/80 hover:border-neutral-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                      {league.flag}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-neutral-900 group-hover:text-[#009739] transition-colors text-sm">
                        {league.name}
                      </h3>
                      <p className="text-[11px] font-mono text-neutral-500">
                        {league.country} • {league.teamCount ? `${league.teamCount} Clubs` : 'Tournament'}
                      </p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 group-hover:bg-neutral-100 transition-colors">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 font-medium">
                  <span>View Official Table</span>
                  <span className="font-mono text-[10px] text-[#009739] font-bold">2026/27</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Additional Global Competitions */}
        {otherLeagues.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-neutral-200/60">
            <h2 className="font-display font-extrabold text-base text-neutral-950 flex items-center gap-2">
              <Globe className="w-4 h-4 text-neutral-600" />
              <span>More Global Competitions</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {otherLeagues.map((league) => (
                <Link
                  key={league.slug}
                  href={`/league/${league.slug}`}
                  className="group bg-white p-4 rounded-xl border border-neutral-200/70 hover:border-neutral-300 shadow-5xs hover:shadow-xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{league.flag}</span>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-xs text-neutral-900 truncate group-hover:text-[#009739] transition-colors">
                        {league.name}
                      </h4>
                      <p className="text-[10px] font-mono text-neutral-400 truncate">
                        {league.country}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
