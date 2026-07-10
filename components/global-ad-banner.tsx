"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles, Zap } from "lucide-react";

export function GlobalAdBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner after a short delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-4xl z-[100] shadow-xl rounded-xl overflow-hidden border border-neutral-200 bg-white text-neutral-900 animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Top micro-bar for label */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-50 border-b border-neutral-100 text-[8px] text-neutral-500 font-mono tracking-widest uppercase select-none pointer-events-none">
        <span>Sponsored Tipster</span>
        <span>Advertisement</span>
      </div>

      {/* Decorative Green Glow Spots */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-24 h-24 bg-emerald-600/5 rounded-full blur-xl pointer-events-none" />

      <div className="relative py-2.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 z-10">
        
        {/* Left Side: Brand & Description */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Sparkle badge */}
          <div className="hidden md:flex shrink-0 w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-500/15 items-center justify-center text-[#009739]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>

          <div className="space-y-0.5 flex-1 sm:flex-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black tracking-widest text-[#009739] uppercase bg-emerald-50 px-1 py-0.2 rounded border border-emerald-500/20">
                AI POWERED
              </span>
            </div>
            <h3 className="text-xs md:text-sm font-black tracking-tight leading-none text-neutral-900 uppercase font-display">
              FREE DAILY AI <span className="text-[#009739]">FOOTBALL PREDICTIONS</span>
            </h3>
          </div>
        </div>

        {/* Right Side: Custom Yellow Pill Button & Close Trigger */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <Link
            href="https://foretips.co.zw"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none inline-flex items-center justify-between sm:justify-start gap-3 bg-[#FFD100] hover:bg-[#FFE04D] text-neutral-950 font-black text-[10px] md:text-[11px] px-3.5 py-1.5 md:py-2 rounded-lg transition-all shadow-md active:scale-98 transform duration-150 shrink-0"
          >
            <span className="tracking-wide font-display uppercase">FORETIPS.CO.ZW | GET TIPS</span>
            <div className="flex items-center gap-0.5 font-mono">
              <Zap className="w-3 h-3 fill-current text-neutral-950" />
              <span className="bg-neutral-950/10 px-1 rounded text-[8px] uppercase tracking-wider font-extrabold text-neutral-900">FREE</span>
            </div>
          </Link>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200/80 text-neutral-500 hover:text-neutral-800 transition-all cursor-pointer border border-neutral-200/50"
            aria-label="Close advertisement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
