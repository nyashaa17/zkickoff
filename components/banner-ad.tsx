'use client';

import React from 'react';

interface BannerAdProps {
  className?: string;
  bannerId?: string;
}

export default function BannerAd({ className = '', bannerId = '1498047' }: BannerAdProps) {
  return (
    <div className={`w-full flex flex-col items-center justify-center py-3 px-4 border border-neutral-200/60 bg-neutral-50/60 rounded-2xl my-4 ${className}`}>
      <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2">SPONSORED ADVERTISEMENT</span>
      <div 
        className="w-full flex items-center justify-center min-h-[90px] overflow-hidden"
        data-banner-id={bannerId}
      />
    </div>
  );
}


