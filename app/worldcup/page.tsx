import React from 'react';
import { Trophy, Info, Sparkles, User, Flag, Calendar, ListOrdered } from 'lucide-react';
import Link from 'next/link';
import { WorldCupSquads } from '@/components/worldcup/squads';
import { WorldCupFixtures } from '@/components/worldcup/fixtures';
import { WorldCupTables } from '@/components/worldcup/tables';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'World Cup 2026 | ZimKickOff',
  description: 'View the latest World Cup 2026 squads, fixtures, and groups tables.',
  alternates: {
    canonical: '/worldcup',
  },
};

export default async function WorldCupPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; team_id?: string }> }) {
  const resolvedParams = await searchParams;
  const currentPage = parseInt(resolvedParams.page || '1', 10);
  const currentTab = resolvedParams.tab || 'squads';

  const sportsLeagueSchema = {
    "@context": "https://schema.org",
    "@type": "SportsLeague",
    "@id": "https://zimkickoff.co.zw/worldcup#league",
    "name": "FIFA World Cup 2026",
    "url": "https://zimkickoff.co.zw/worldcup",
    "sport": "https://en.wikipedia.org/wiki/Association_football",
    "description": "The FIFA World Cup 2026, featuring 48 international teams competing across North America."
  };

  const webpageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/worldcup#webpage",
    "url": "https://zimkickoff.co.zw/worldcup",
    "name": "World Cup 2026 squads, fixtures, and tables | ZimKickOff",
    "description": "View the latest World Cup 2026 squads, fixtures, and groups tables.",
    "isPartOf": {
      "@id": "https://zimkickoff.co.zw/#website"
    },
    "publisher": {
      "@type": "Organization",
      "name": "ZimKickOff",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zimkickoff.co.zw/apple-touch-icon.png"
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsLeagueSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageSchema) }}
      />
      <div className="mb-8 p-6 md:p-8 bg-neutral-900 rounded-3xl text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#009739]/20 to-transparent rounded-full blur-3xl" />
        <div className="relative z-10 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-neutral-200 tracking-wider mb-4 border border-white/5 backdrop-blur-sm uppercase">
            <Sparkles className="w-3.5 h-3.5 text-zim-yellow" />
            Official Data
          </div>
          <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight mb-4">World Cup 2026</h1>
          <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
            Stay updated with the latest team squads, match fixtures, and groups tables for the 2026 FIFA World Cup.
          </p>
        </div>
        <div className="relative z-10 shrink-0 w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex flex-col items-center justify-center p-4">
          <Trophy className="w-10 h-10 md:w-14 md:h-14 text-zim-yellow drop-shadow-lg" />
        </div>
      </div>

      <div className="mb-8 flex overflow-x-auto pb-4 hide-scrollbar gap-2">
        <Link 
          href="/worldcup?tab=squads" 
          className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            currentTab === 'squads' ? 'bg-[#009739] text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <User className="w-5 h-5" />
          Squads
        </Link>
        <Link 
          href="/worldcup?tab=fixtures" 
          className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            currentTab === 'fixtures' ? 'bg-[#009739] text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <Calendar className="w-5 h-5" />
          Fixtures
        </Link>
        <Link 
          href="/worldcup?tab=tables" 
          className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            currentTab === 'tables' ? 'bg-[#009739] text-white shadow-md' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <ListOrdered className="w-5 h-5" />
          Groups Tables
        </Link>
      </div>

      <div className="flex flex-col gap-6">
         {currentTab === 'squads' && <WorldCupSquads page={currentPage} teamId={resolvedParams.team_id} />}
         {currentTab === 'fixtures' && <WorldCupFixtures />}
         {currentTab === 'tables' && <WorldCupTables />}
      </div>
    </div>
  );
}
