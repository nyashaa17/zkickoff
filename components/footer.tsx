'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Shield, FileText, ExternalLink, Play, Keyboard, Award, Scale } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-footer" className="bg-white border-t border-neutral-200/50 mt-auto">
      {/* Main Footer Content */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-block select-none">
              <span className="font-display font-black text-xl tracking-tight flex items-center">
                <span className="text-zim-green">Zim</span>
                <span className="text-zim-black">Kick</span>
                <span className="text-zim-red">Off</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links Column */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-neutral-900 font-display font-extrabold text-xs tracking-wider uppercase">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              <li>
                <Link href="/" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-neutral-400" />
                  Home
                </Link>
              </li>
              <li>
                <Link href="/live" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zim-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zim-red"></span>
                  </span>
                  Today&apos;s Matches
                </Link>
              </li>
              <li>
                <Link href="/worldcup" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-neutral-400" />
                  World Cup
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-neutral-400" />
                  About us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  Contact us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Policy Links Column */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-neutral-900 font-display font-extrabold text-xs tracking-wider uppercase">
              Information & Policies
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold">
              <li>
                <Link href="/privacy" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-neutral-400" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="text-neutral-500 hover:text-zim-green transition-colors inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-neutral-400" />
                  DMCA Policy
                </Link>
              </li>
              <li className="pt-2">
                <div className="border border-neutral-200/60 rounded-2xl p-4 bg-neutral-50 space-y-2">
                  <h5 className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider">Disclaimer Notice</h5>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                    Disclaimer: ZimKickOff is an aggregation platform that provides links to publicly available sports content. We do not host, upload, encode, or produce any streaming content.
                  </p>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                    All streams are sourced from third parties and remain their responsibility. Users access third-party streams at their own risk. ZimKickOff is not liable for content quality, availability, legality, or interruptions. We comply with DMCA takedown requests and encourage users to support official broadcasters.
                  </p>
                </div>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright & system strip */}
        <div className="border-t border-neutral-100 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-neutral-400">
          <div>
            &copy; {currentYear} <span className="text-neutral-600 font-bold">ZimKickOff</span>. All rights reserved.
          </div>

        </div>
      </div>
    </footer>
  );
}
