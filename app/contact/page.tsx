'use client';

import React from 'react';
import Breadcrumbs from '@/components/breadcrumbs';
import { Clock, Mail, AlertCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';

export default function ContactPage() {

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'Contact Us' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-3xl mx-auto">
        <div className="text-center pb-6 mb-8 border-b border-neutral-150">
          <span className="text-[11px] font-mono font-black text-zim-green bg-[#e8f3ec] px-3 py-1 rounded-full uppercase tracking-wider">
            Active Support Channel
          </span>
          <h1 className="text-xl md:text-3xl font-display font-black text-neutral-900 mt-4 mb-2 tracking-tight">
            Get in Touch
          </h1>
          <p className="text-neutral-500 text-xs md:text-sm max-w-md mx-auto">
            Have alignment recommendations, feedback, content complaints, or DMCA requests? Reach out directly through our active support method.
          </p>
        </div>

        <div className="space-y-6">
          {/* Primary Email Support Card */}
          <div className="border border-neutral-200/70 rounded-2xl p-6 md:p-8 bg-neutral-50/50 text-center space-y-4 hover:border-neutral-300 transition-all">
            <div className="w-14 h-14 bg-zim-green/10 text-zim-green rounded-full flex items-center justify-center mx-auto shadow-xs">
              <Mail className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base md:text-lg font-display font-black text-neutral-900">
                Official Email Support
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Our team is active and answers inquiries via email. Click the button below to message our support desk directly.
              </p>
            </div>

            <div className="pt-2">
              <a 
                href={SITE_CONFIG.supportEmailHref}
                className="inline-flex items-center gap-2 bg-zim-green hover:bg-zim-green/90 text-white text-xs font-black px-6 py-3.5 rounded-xl shadow-md md:shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                Send an Email
              </a>
            </div>
            
            <div className="text-[11px] text-neutral-500 font-mono">
              <a href={SITE_CONFIG.supportEmailHref} className="hover:text-zim-green hover:underline">
                {SITE_CONFIG.supportEmail}
              </a>
            </div>
          </div>

          {/* Guidelines / Response period Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3.5 p-4 border border-neutral-100 rounded-2xl bg-white/50">
              <Clock className="w-4 h-4 text-zim-yellow shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-neutral-900">Estimated Reply Delay</h4>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                  Most inquiries sent during working hours are reviewed within a few hours. Complete processing takes under 24 hours.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 border border-neutral-100 rounded-2xl bg-white/50">
              <AlertCircle className="w-4 h-4 text-zim-red shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-neutral-900">Index Aggregator Notice</h4>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-normal">
                  We function as an aggregator index. Removal notices and feed reports will be addressed expeditiously directly on our lists.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
