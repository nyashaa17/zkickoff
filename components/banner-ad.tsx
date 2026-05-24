'use client';

import React, { useEffect, useRef } from 'react';

export default function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && containerRef.current) {
      // Clear container first to prevent duplicate loading on re-renders
      containerRef.current.innerHTML = '';

      // Set global atOptions configuration
      (window as any).atOptions = {
        key: 'ed4e1c2f241bc6246edffb64798fa5e8',
        format: 'iframe',
        height: 250,
        width: 300,
        params: {}
      };

      // Create and append configuration script element
      const configScript = document.createElement('script');
      configScript.type = 'text/javascript';
      configScript.text = `
        atOptions = {
          'key' : 'ed4e1c2f241bc6246edffb64798fa5e8',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300,
          'params' : {}
        };
      `;

      // Create and append execution/invoke script element
      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.src = '//www.highperformanceformat.com/ed4e1c2f241bc6246edffb64798fa5e8/invoke.js';

      containerRef.current.appendChild(configScript);
      containerRef.current.appendChild(invokeScript);
    }
  }, []);

  return (
    <div id="ad-banner-container" className="w-full flex flex-col items-center justify-center py-6 border-y border-neutral-100 bg-neutral-50/45 rounded-none my-6">
      <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest mb-2">SPONSORED ADVERTISEMENT</span>
      <div 
        ref={containerRef} 
        style={{ width: '300px', height: '250px' }} 
        className="w-[300px] h-[250px] bg-white border border-neutral-200/50 shadow-3xs rounded-none flex items-center justify-center overflow-hidden"
      />
    </div>
  );
}
