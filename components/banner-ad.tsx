'use client';

import React from 'react';

interface BannerAdProps {
  format?: '300x250' | '728x90' | 'responsive';
  className?: string;
  adSlotId?: string;
}

export default function BannerAd({ format = '300x250', className = '', adSlotId }: BannerAdProps) {
  const getDimensions = () => {
    switch (format) {
      case '728x90':
        return 'w-[728px] h-[90px] max-w-full';
      case 'responsive':
        return 'w-full min-h-[100px]';
      case '300x250':
      default:
        return 'w-[300px] h-[250px]';
    }
  };

  return (
    <div id={adSlotId ? `ad-slot-${adSlotId}` : 'ad-banner-container'} className={`w-full flex flex-col items-center justify-center py-4 border-y border-neutral-100 bg-neutral-50/50 my-4 ${className}`}>
      <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2">SPONSORED ADVERTISEMENT</span>
      <div 
        className={`${getDimensions()} bg-white border border-neutral-200/60 shadow-xs flex items-center justify-center overflow-hidden relative`}
      >
        <div data-banner-id="1498047"></div>
      </div>
    </div>
  );
}


