'use client';

import React from 'react';

export default function BannerAd() {
  return (
    <div id="ad-banner-container" className="w-full flex flex-col items-center justify-center py-6 border-y border-neutral-100 bg-neutral-50/45 rounded-none my-6">
      <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2">SPONSORED ADVERTISEMENT</span>
      <div 
        style={{ width: '300px', height: '250px' }} 
        className="w-[300px] h-[250px] bg-white border border-neutral-200/50 shadow-3xs rounded-none flex items-center justify-center overflow-hidden"
      >
        <span className="text-neutral-400 text-sm font-medium">Ad Placeholder</span>
        {/* TODO: Integrate new ad network script here */}
      </div>
    </div>
  );
}

