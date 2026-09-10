import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LEAGUES_REGISTRY, getLeagueBySlug } from '@/lib/leagues-config';
import { fetchLeagueStandings } from '@/lib/standings-service';
import { LeagueTable } from '@/components/standings/league-table';
import Breadcrumbs from '@/components/breadcrumbs';
import { Trophy, Globe2, ChevronRight, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

export const revalidate = 300; // ISR cache for 5 minutes

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return LEAGUES_REGISTRY.map((league) => ({
    slug: league.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const league = getLeagueBySlug(slug);

  if (!league) {
    return {
      title: 'League Standings | ZimKickOff',
      description: 'Live football league standings and tables on ZimKickOff.'
    };
  }

  const title = `${league.name} Table & Standings (2026/27) | ZimKickOff`;
  const description = `Live updated ${league.name} standings table, match records, goal differences, form, and qualification zones on ZimKickOff.`;
  const canonicalUrl = `https://zimkickoff.co.zw/league/${league.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'ZimKickOff',
      locale: 'en_ZW'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

export default async function LeagueStandingsPage({ params }: PageProps) {
  const { slug } = await params;
  const league = getLeagueBySlug(slug);

  if (!league) {
    notFound();
  }

  const result = await fetchLeagueStandings(league.slug);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Breadcrumb Nav */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Leagues', href: '/league' },
            { label: league.name }
          ]}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-6">
        
        {/* League Hero Header Card */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 md:p-7 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            
            {/* Title & Badge */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-center text-3xl shrink-0 shadow-xs">
                {league.flag}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-[#009739] bg-[#009739]/10 px-2 py-0.5 rounded">
                    {league.country}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    {result?.seasonName || '2026/2027 Season'}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-display font-extrabold text-neutral-950 tracking-tight">
                  {league.name} Standings
                </h1>
              </div>
            </div>

            {/* Quick stats or status pill */}
            <div className="flex items-center gap-3">
              <div className="bg-neutral-50 px-3.5 py-2 rounded-xl border border-neutral-200/60 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#009739] animate-pulse" />
                <span className="font-mono font-bold text-neutral-700">Auto-Updated Table</span>
              </div>
            </div>
          </div>

          {/* Quick League Selector Carousel / Tab Strip */}
          <div className="mt-6 pt-4 border-t border-neutral-100 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 min-w-max">
              <span className="text-[11px] font-mono font-bold text-neutral-400 mr-1 uppercase">
                Top Leagues:
              </span>
              {LEAGUES_REGISTRY.map((l) => {
                const isActive = l.slug === league.slug;
                return (
                  <Link
                    key={l.slug}
                    href={`/league/${l.slug}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-3xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.shortName}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Standings Table Component */}
        <LeagueTable
          league={league}
          standings={result?.standings}
          groups={result?.groups}
          isGrouped={result?.isGrouped}
          seasonName={result?.seasonName}
        />

        {/* SEO Context & Editorial Footer */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-xs space-y-3 text-neutral-600 text-xs leading-relaxed">
          <h2 className="font-display font-extrabold text-sm text-neutral-950">
            About {league.name} Standings & Qualification
          </h2>
          <p>
            Welcome to the official {league.name} league table on ZimKickOff. Track live points, match records, goal differences, and recent form throughout the {result?.seasonName || '2026/2027'} season. Standings update automatically as match results are finalized.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 font-mono">
            <span>• Data Provider: Bzzoiro Sports Engine</span>
            <span>• Refresh Frequency: Every 5 Minutes</span>
            <span>• Format: Official League Rules</span>
          </div>
        </div>

      </main>
    </div>
  );
}
