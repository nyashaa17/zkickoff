'use client';

import React from 'react';
import Breadcrumbs from '@/components/breadcrumbs';

export default function PrivacyPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'Privacy Policy' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto">
        <div className="border-b border-neutral-150 pb-6 mb-8">
          <span className="text-[11px] font-mono font-black text-neutral-400 uppercase tracking-wider">
            Effective Date: May 24, 2026
          </span>
          <h1 className="text-xl md:text-3xl font-display font-black text-neutral-900 mt-2 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-neutral-500 text-sm mt-3">
            At ZimKickOff, we prioritize the protection and preservation of our visitors&apos; privacy. This document outlines how we track or treat anonymous data.
          </p>
        </div>

        <div className="space-y-6 text-xs md:text-sm text-neutral-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">1. Information Collection</h2>
            <p>
              We run a direct-access, sign-up-free platform. We do not ask for, request, or store your personalized identifiable information, such as real names, home or shipping addresses, contact details, or financial accounts.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">2. Log Files and System Metrics</h2>
            <p>
              ZimKickOff follows a standard procedure of utilizing server log files. These files automatically log visitors when they access our node. The information collected includes Internet Protocol (IP) address clusters, device specifications, browser structures, timestamp indications, and referring pages. These metrics help analyze trends and administer web performance logs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">3. Cookies and Tracking Pixels</h2>
            <p>
              We use lightweight localized cookies strictly to store interface preferences, such as selected competition presets and favorite league visual settings. These help maintain smooth transitions on subsequent visits.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">4. Third-Party Web Embedding</h2>
            <p>
              Some live video players or schedules are integrated from third-party media platforms. Those external vendors may implement tracking technologies or capture user agents. We advise corresponding with their individual privacy statements to obtain instructions for opt-out details.
            </p>
          </section>

          <section className="space-y-2 pb-4">
            <h2 className="text-sm font-display font-bold text-neutral-900">5. Contact and Revision Inquiries</h2>
            <p>
              Any inquiries concerning our anonymous privacy workflows should be directed through our Contact desk or addressed to support@zimkickoff.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
