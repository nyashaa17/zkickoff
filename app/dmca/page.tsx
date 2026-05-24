'use client';

import React from 'react';
import Breadcrumbs from '@/components/breadcrumbs';

export default function DMCAPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'DMCA Policy' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto">
        <div className="border-b border-neutral-150 pb-6 mb-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono font-black text-neutral-400 uppercase tracking-wider">
            <span>Effective Date: May 24, 2026</span>
            <span className="hidden sm:inline text-neutral-300">•</span>
            <span>Last Updated: May 24, 2026</span>
          </div>
          <h1 className="text-xl md:text-3xl font-display font-black text-neutral-900 mt-2 tracking-tight">
            DMCA Policy
          </h1>
          <p className="text-neutral-500 text-sm mt-3">
            Copyright claims, DMCA compliance status, and digital content takedown procedures.
          </p>
        </div>

        <div className="space-y-6 text-xs md:text-sm text-neutral-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">1. DMCA Compliance</h2>
            <p>
              ZimKickOff respects the intellectual property rights of others and complies with the Digital Millennium Copyright Act (DMCA). We respond to valid DMCA takedown notices in accordance with applicable law and regulations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">2. Our Role</h2>
            <p>
              ZimKickOff operates strictly as an aggregation platform that provides links to publicly available streaming content hosted on external, third-party servers. We do not host, upload, encode, record, or transmit any live streaming content directly.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">3. Reporting Copyright Infringement</h2>
            <p>
              If you are a copyright owner or an authorized agent thereof and believe that any content accessible through ZimKickOff infringes upon your copyright rights, you may submit a formal notification pursuant to the DMCA by providing our designated copyright agent with the following information in writing.
            </p>
            <div className="bg-neutral-50/70 border border-neutral-250/40 rounded-2xl p-4 md:p-5 mt-3 space-y-2.5">
              <h3 className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">3.1 Required Information</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-neutral-500 font-medium">
                <li>A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
                <li>Identification of the copyrighted work claimed to have been infringed, or, if multiple works at a single site are covered by a single notification, a representative list of such works.</li>
                <li>Identification of the material that is claimed to be infringing or to be the subject of infringing activity and that is to be removed or access to which is to be disabled, and information reasonably sufficient to allow us to locate the material (including specific URLs).</li>
                <li>Information reasonably sufficient to permit us to contact you, such as an address, telephone number, and, if available, an email address.</li>
                <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">4. Counter-Notification</h2>
            <p>
              If you believe that your content was removed or disabled by mistake or misidentification, you may submit a counter-notification to our designated agent containing the following details:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs font-semibold text-neutral-500">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that has been removed or to which access has been disabled, and the location at which the material appeared before it was removed or disabled.</li>
              <li>A statement under penalty of perjury that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material.</li>
              <li>Your contact information (name, address, telephone number, and email address).</li>
              <li>A statement that you consent to the jurisdiction of the federal court district in which your address is located, or if your address is outside of the United States, for any judicial district in which the service provider may be found, and that you will accept service of process from the person who provided the original infringement notification.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">5. Repeat Infringers</h2>
            <p>
              In accordance with the DMCA and other applicable laws, ZimKickOff maintains a strict policy of terminating user access or removing listings for repeat copyright infringers under appropriate circumstances.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">6. Contact for DMCA Notices</h2>
            <p>
              To file a DMCA takedown notice or a counter-notice, please send all relevant electronic document submissions explaining the claim through our official <a href="https://t.me/Eratech_zw" target="_blank" rel="noopener noreferrer" className="text-zim-green font-bold hover:underline">Telegram Support Chat (https://t.me/Eratech_zw)</a> or via our <a href="/contact" className="text-zim-green font-bold hover:underline">Contact page</a>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-display font-bold text-neutral-900">7. Processing Time</h2>
            <p>
              We aim to process and act upon valid DMCA takedown notices within <span className="text-neutral-800 font-bold">24-48 hours</span> of receipt. Please allow reasonable time for legal review and administrative action.
            </p>
          </section>

          <section className="space-y-2 pb-4">
            <h2 className="text-sm font-display font-bold text-neutral-900">8. False Claims</h2>
            <p className="text-zim-red/95 font-semibold">
              Please note that submitting false, malicious, or intentionally misleading DMCA notices or counter-notifications may result in substantial civil or legal liability under federal law.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
