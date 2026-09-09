"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { X, Sparkles, ExternalLink } from 'lucide-react';

export function PredictionsBanner() {
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  if (!isBannerVisible) return null;

  return (
    <div className="fixed bottom-[160px] left-4 right-4 md:left-6 md:w-[340px] md:bottom-6 z-[60] bg-white dark:bg-[#141417] border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <button 
        onClick={() => setIsBannerVisible(false)}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-full text-neutral-400 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green to-[#FFD100] shrink-0 flex items-center justify-center text-neutral-950 shadow-inner">
          <Sparkles className="w-6 h-6 text-neutral-950" />
        </div>
        <div className="pr-2">
          <span className="text-[9px] font-mono font-black text-neutral-950 dark:text-white bg-brand-green/20 border border-brand-green/40 px-1.5 py-0.5 rounded uppercase tracking-wider mb-1 inline-block">Recommended</span>
          <p className="text-sm font-black text-neutral-900 dark:text-white leading-tight mb-1.5">Free Football Predictions</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-[200px]">
            Check out Foretips.co.zw for the best accurate football predictions and insights today.
          </p>
          <Link 
            href="https://foretips.co.zw" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mt-3.5 inline-flex items-center gap-1.5 bg-brand-green hover:bg-brand-green-hover text-neutral-950 font-black text-xs py-2 px-4 rounded-xl transition-all shadow-md shadow-brand-green/20 hover:translate-y-[-1px]"
          >
            View Predictions
            <ExternalLink className="w-3.5 h-3.5 text-neutral-950" />
          </Link>
        </div>
      </div>
    </div>
  );
}
