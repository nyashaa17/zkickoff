'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, MessageCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-footer" className="bg-black border-t border-neutral-800 mt-auto text-white">
      {/* Main Footer Content */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-neutral-800">
          
          {/* Brand & Social Column */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/" className="inline-block select-none" aria-label="ZKickoff">
              <Image
                src="/ZKickoff_logo.svg"
                alt="ZKickoff"
                width={1107}
                height={224}
                unoptimized
                className="w-[140px] sm:w-[160px] h-auto object-contain aspect-[1107/224]"
              />
            </Link>
            <div className="flex items-center gap-3 sm:border-l sm:border-neutral-800 sm:pl-4">
              <a
                href={SITE_CONFIG.supportEmailHref}
                className="p-1.5 text-white hover:text-brand-green hover:bg-white/10 rounded-lg transition-all flex items-center justify-center"
                aria-label="Email Support"
                title="Email Support"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbCawa77YSd8W5QIHA41"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-white hover:text-[#25D366] hover:bg-[#25D366]/20 rounded-lg transition-all flex items-center justify-center"
                aria-label="WhatsApp Channel"
                title="WhatsApp Channel"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Flat Links List */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white">
            <Link href="/" className="hover:text-brand-green transition-colors">
              Home
            </Link>
            <Link href="/live" className="hover:text-brand-green transition-colors">
              Today&apos;s Matches
            </Link>
            <Link href="/?tab=UPCOMING" className="hover:text-brand-green transition-colors">
              Upcoming Matches
            </Link>
            <Link href="/league" className="hover:text-brand-green transition-colors">
              League Tables
            </Link>
            <Link href="/worldcup" className="hover:text-brand-green transition-colors">
              World Cup
            </Link>
            <Link href="/about" className="hover:text-brand-green transition-colors">
              About us
            </Link>
            <Link href="/contact" className="hover:text-brand-green transition-colors">
              Contact us
            </Link>
            <Link href="/privacy" className="hover:text-brand-green transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-brand-green transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/dmca" className="hover:text-brand-green transition-colors">
              DMCA Policy
            </Link>
            <Link href="/sitemap.xml" className="hover:text-brand-green transition-colors">
              Sitemap
            </Link>
          </div>

        </div>

        {/* Disclaimer Notice */}
        <div className="mt-8 space-y-2 text-white/90">
          <p className="text-xs leading-relaxed font-normal">
            Disclaimer: ZimKickOff is an aggregation platform that provides links to publicly available sports content. We do not host, upload, encode, or produce any streaming content. All streams are sourced from third parties and remain their responsibility.
          </p>
          <p className="text-xs leading-relaxed font-normal">
            Users access third-party streams at their own risk. ZimKickOff is not liable for content quality, availability, legality, or interruptions. We comply with DMCA takedown requests and encourage users to support official/licensed broadcasters.
          </p>
        </div>

        {/* Bottom copyright & system strip */}
        <div className="border-t border-neutral-800 mt-8 pt-6 flex flex-row items-center justify-center sm:justify-between gap-4 text-xs font-normal text-white/90">
          <div className="flex items-center justify-center flex-wrap gap-y-1 gap-x-2 text-center w-full">
            <span>&copy; {currentYear} <span className="font-semibold text-white">ZKickoff</span>. All rights reserved.</span>
            <span className="text-white/40">|</span>
            <span>Developed by <span className="font-semibold text-white">Eratech</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
