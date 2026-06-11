"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function GlobalAdBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay before showing to ensure smooth page load
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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-[320px] md:right-6 md:bottom-6 z-[100] shadow-2xl rounded-2xl overflow-hidden border border-green-500/30 bg-white group animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="relative block h-[100px] md:h-[110px] bg-neutral-900 group">
        <Link
          href="https://winbucks.co.zw/?aff=19220"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 block h-full w-full bg-gradient-to-r from-[#009739] to-green-600 flex flex-col items-center justify-center text-white p-3 text-center transition-transform duration-500 group-hover:scale-105"
        >
          <span className="font-extrabold text-lg mb-0.5 drop-shadow-md">Winbucks Casino 🎲</span>
          <span className="text-xs font-bold drop-shadow-md">Deposit $1 and Get 10 Free Spins!</span>
          <span className="text-[10px] bg-white text-[#009739] px-3 py-1 rounded-full mt-2 font-black tracking-widest shadow-md uppercase bounce-animation">Claim Now</span>
        </Link>
        
        <button
          onClick={handleClose}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer z-10 backdrop-blur-md shadow-sm border border-white/10"
          aria-label="Close advertisement"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

