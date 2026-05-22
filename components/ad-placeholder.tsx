'use client';

import React from 'react';
import { ExternalLink, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface AdPlaceholderProps {
  type: 'banner' | 'sidebar' | 'inline';
}

export default function AdPlaceholder({ type }: AdPlaceholderProps) {
  if (type === 'banner') {
    return (
      <div id="ad-banner" className="w-full bg-white border border-neutral-200/80 rounded-xl p-4 md:p-6 mb-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 bg-neutral-100 text-[10px] text-neutral-400 font-mono px-2 py-0.5 rounded-bl border-l border-b border-neutral-100">
          SPONSORED
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#009739] via-[#FFD100] to-[#D62828] flex items-center justify-center text-white font-black text-xl shadow-inner shrink-0">
            ZK
          </div>
          <div>
            <h4 className="font-display font-semibold text-neutral-900 text-sm md:text-base flex items-center gap-1.5">
              ZimKickOff Ad Space <Award className="w-4 h-4 text-zim-yellow animate-bounce" />
            </h4>
            <p className="text-neutral-500 text-xs md:text-sm mt-0.5 max-w-xl">
              {"Advertise with Zimbabwe's fastest-growing football community. Clean, high-CTR, target-oriented slots starting from $10/month."}
            </p>
          </div>
        </div>

        <motion.a
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          href="mailto:ads@zimkickoff.co.zw"
          className="px-4 py-2 bg-zim-black hover:bg-neutral-800 text-white font-display text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap self-stretch md:self-auto justify-center"
        >
          Partner With Us
          <ExternalLink className="w-3.5 h-3.5 text-zim-yellow" />
        </motion.a>
      </div>
    );
  }

  if (type === 'sidebar') {
    return (
      <div id="ad-sidebar" className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col items-center text-center">
        <span className="absolute top-0 right-0 bg-neutral-100 text-[9px] text-neutral-400 font-mono px-1.5 py-0.5 rounded-bl">
          SPONSOR
        </span>
        
        <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-zim-green my-2">
          <span className="font-display font-black text-2xl tracking-tighter">ZIM</span>
        </div>

        <h4 className="font-display font-semibold text-sm text-neutral-950 mt-1">
          Fly To Victoria Falls!
        </h4>
        <p className="text-neutral-500 text-xs mt-2 leading-relaxed">
          {"Amazing low-cost local weekend packages are available now. Explore Zimbabwe's prime attraction."}
        </p>

        <a
          href="https://picsum.photos/seed/travel/1600/900"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-full py-2 bg-zim-green text-zim-white font-display text-xs font-semibold rounded-lg hover:bg-opacity-95 transition-all"
        >
          Book Flight Now
        </a>
      </div>
    );
  }

  return (
    <div id="ad-inline" className="bg-neutral-50 border border-neutral-200 border-dashed rounded-xl p-4 my-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-500 text-xs">
      <span className="font-semibold text-[10px] tracking-widest uppercase font-mono bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded">
        AD ADVERTISING
      </span>
      <span>Enjoying high-fidelity, buffer-free match streams? Consider Whitelisting us on your Adblocker!</span>
      <button className="text-zim-green hover:underline cursor-pointer font-semibold whitespace-nowrap">
        Learn More &rsaquo;
      </button>
    </div>
  );
}
