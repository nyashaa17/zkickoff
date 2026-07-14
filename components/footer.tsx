'use client';

import React from 'react';
import Link from 'next/link';
import { Send, MessageCircle } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-footer" className="bg-white border-t border-neutral-200/50 mt-auto text-black">
      {/* Main Footer Content */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-neutral-200/60">
          
          {/* Brand & Social Column */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/" className="inline-block select-none">
              <span className="font-display font-black text-xl tracking-tight flex items-center text-black">
                <span className="text-zim-green">Zim</span>
                <span>Kick</span>
                <span className="text-zim-red">Off</span>
              </span>
            </Link>
            <div className="flex items-center gap-3 sm:border-l sm:border-neutral-200 sm:pl-4">
              <a
                href="https://t.me/Eratech_zw"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-black hover:text-[#0088cc] hover:bg-[#0088cc]/5 rounded-lg transition-all flex items-center justify-center"
                aria-label="Telegram Channel"
                title="Telegram Channel"
              >
                <Send className="w-5 h-5" />
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbCawa77YSd8W5QIHA41"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-black hover:text-[#25D366] hover:bg-[#25D366]/5 rounded-lg transition-all flex items-center justify-center"
                aria-label="WhatsApp Channel"
                title="WhatsApp Channel"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Flat Links List */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-black">
            <Link href="/" className="hover:text-zim-green transition-colors">
              Home
            </Link>
            <Link href="/live" className="hover:text-zim-green transition-colors">
              Today&apos;s Matches
            </Link>
            <Link href="/worldcup" className="hover:text-zim-green transition-colors">
              World Cup
            </Link>
            <Link href="/about" className="hover:text-zim-green transition-colors">
              About us
            </Link>
            <Link href="/contact" className="hover:text-zim-green transition-colors">
              Contact us
            </Link>
            <Link href="/privacy" className="hover:text-zim-green transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-zim-green transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/dmca" className="hover:text-zim-green transition-colors">
              DMCA Policy
            </Link>
            <Link href="/sitemap.xml" className="hover:text-zim-green transition-colors">
              Sitemap
            </Link>
          </div>

        </div>

        {/* Disclaimer Notice */}
        <div className="mt-8 space-y-2 text-black">
          <p className="text-xs leading-relaxed font-semibold">
            Disclaimer: ZimKickOff is an aggregation platform that provides links to publicly available sports content. We do not host, upload, encode, or produce any streaming content. All streams are sourced from third parties and remain their responsibility.
          </p>
          <p className="text-xs leading-relaxed font-semibold">
            Users access third-party streams at their own risk. ZimKickOff is not liable for content quality, availability, legality, or interruptions. We comply with DMCA takedown requests and encourage users to support official/licensed broadcasters.
          </p>
        </div>

        {/* Bottom copyright & system strip */}
        <div className="border-t border-neutral-100 mt-8 pt-6 flex flex-row items-center justify-center sm:justify-between gap-4 text-xs font-semibold text-black">
          <div className="flex items-center justify-center flex-wrap gap-y-1 gap-x-2 text-center w-full">
            <span>&copy; {currentYear} <span className="font-extrabold">ZimKickOff</span>. All rights reserved.</span>
            <span className="text-neutral-300">|</span>
            <span>Developed by <span className="font-extrabold">Eratech</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
