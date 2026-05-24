'use client';

import React from 'react';
import Breadcrumbs from '@/components/breadcrumbs';
import { Award, Tv, ShieldAlert, Cpu } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'About Us' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] font-mono font-black text-zim-green bg-[#e8f3ec] px-3 py-1 rounded-full uppercase tracking-wider">
            Our Platform
          </span>
          <h1 className="text-xl md:text-3xl font-display font-black text-neutral-900 mt-3 mb-4 tracking-tight">
            About ZimKickOff
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Leading the way in Zimbabwean local sports reporting, active match scores, and real-time Castle Lager Premier Soccer League integration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="p-5 border border-neutral-100 rounded-2xl bg-neutral-50/50">
            <Tv className="w-8 h-8 text-zim-green mb-3.5" />
            <h3 className="font-display font-extrabold text-neutral-900 mb-2 text-sm md:text-base">
              Superb Stream Aggregation
            </h3>
            <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
              We scout and curate entirely public broadcasts and open satellite feeds with minimum latency, delivering effortless kickoff support for dynamic local matches.
            </p>
          </div>

          <div className="p-5 border border-neutral-100 rounded-2xl bg-neutral-50/50">
            <Award className="w-8 h-8 text-zim-yellow mb-3.5" />
            <h3 className="font-display font-extrabold text-neutral-900 mb-2 text-sm md:text-base">
              Dedicated Fan Core
            </h3>
            <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
              Serving Zim football lovers with instant live match statistics, standings summaries, and precise fixtures for top giants like Dynamos, Highlanders, and CAPS United.
            </p>
          </div>

          <div className="p-5 border border-neutral-100 rounded-2xl bg-neutral-50/50">
            <Cpu className="w-8 h-8 text-zim-black mb-3.5" />
            <h3 className="font-display font-extrabold text-neutral-900 mb-2 text-sm md:text-base">
              Zero Signup Barriers
            </h3>
            <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
              No payments, no credit card requests, and no mandatory registration. Tap any active event and dive immediately into matches and live chat integrations.
            </p>
          </div>

          <div className="p-5 border border-neutral-100 rounded-2xl bg-neutral-50/50">
            <ShieldAlert className="w-8 h-8 text-zim-red mb-3.5" />
            <h3 className="font-display font-extrabold text-neutral-900 mb-2 text-sm md:text-base">
              Honorable Compliance
            </h3>
            <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
              Our index operates strictly as a news and search conduit. Any content displayed in player frames originates straight from external open hosting sources.
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-150 pt-8 text-center bg-neutral-50/50 rounded-2xl p-6 border border-neutral-200/40">
          <p className="text-xs text-neutral-500 leading-relaxed max-w-xl mx-auto">
            Supporting Zimbabwean football with reliable technical layouts, pure mobile optimizations, and premium aesthetics. Feel free to contact our administrative desk for query reviews or suggestions.
          </p>
        </div>
      </div>
    </div>
  );
}
