'use client';

import React from 'react';
import Breadcrumbs from '@/components/breadcrumbs';

export default function TermsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'Terms & Conditions' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto">
        <div className="border-b border-neutral-150 pb-6 mb-8">
          <span className="text-[11px] font-mono font-black text-neutral-400 uppercase tracking-wider">
            Effective Date: May 24, 2026
          </span>
          <h1 className="text-xl md:text-3xl font-display font-black text-neutral-900 mt-2 tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-neutral-500 text-sm mt-3">
            Please read these terms and conditions carefully before using the ZimKickOff platform.
          </p>
        </div>

        <div className="space-y-6 text-xs md:text-sm text-neutral-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">1. Terms Acceptance</h2>
            <p>
              By accessing any portion of the ZimKickOff website, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to the complete ruleset, please cease using this aggregate service immediately.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">2. Scope of Service</h2>
            <p>
              ZimKickOff serves purely as a sports reporting dashboard. The site gathers and presents football match standings, current stats lists, and embeds public links of online broadcasts. We make no guarantees on transmission accuracy, absolute server reliability, or continuous schedule availability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">3. Non-Hosting &amp; Media Disclaimer</h2>
            <p>
              ZimKickOff does not cast, record, host, or upload copyright video streams. All match players displayed inside the viewer wrapper represent embedded third-party frames from independent external domains. Content liability, copyright policies, and server licenses belong in full to their respective third-party providers. We promptly remove frames linking to broken or illegal addresses upon support review.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">4. Prohibited Personal Conduct</h2>
            <p>
              Users must refrain from targeting the website with scraping frameworks, automated bot loops, denial-of-service script launches, or system-disrupting tasks. Misbehavior in chat logs or live components will result in immediate IP-specific blocking.
            </p>
          </section>

          <section className="space-y-2 pb-4">
            <h2 className="text-sm font-display font-bold text-neutral-900">5. Right to Amends</h2>
            <p>
              The management desk reserves the right to edit or modify these conditions or restrict user access at any time to guarantee security compliance. Regular visitation constitutes approval of our current, active rules.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
