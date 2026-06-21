"use client";

import React, { useEffect, useRef } from "react";

export function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run on the client side
    if (typeof window === "undefined" || !containerRef.current) return;

    // Check if script is already added in this container to prevent duplicate loads
    const hasScript = containerRef.current.querySelector('script[src*="highperformanceformat.com"]');
    if (hasScript) return;

    // Save existing atOptions if any, in case of page-level state collision
    const previousAtOptions = (window as any).atOptions;

    // Set configuration for Adsterra
    (window as any).atOptions = {
      key: "ed4e1c2f241bc6246edffb64798fa5e8",
      format: "iframe",
      height: 250,
      width: 300,
      params: {},
    };

    // Create container-bound script tag
    const script = document.createElement("script");
    script.src = "https://www.highperformanceformat.com/ed4e1c2f241bc6246edffb64798fa5e8/invoke.js";
    script.async = true;

    // Append to this component's specific wrapper
    const currentContainer = containerRef.current;
    currentContainer.appendChild(script);

    // Cleanup on unmount
    return () => {
      if (currentContainer) {
        currentContainer.innerHTML = "";
      }
      // Revert to any previous atOptions
      (window as any).atOptions = previousAtOptions;
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-6 overflow-hidden rounded-2xl border border-neutral-200/50 bg-white p-3 shadow-xs">
      <div className="flex items-center justify-between w-full max-w-[300px] mb-2 px-1 text-neutral-400">
        <span className="text-[9px] font-mono uppercase tracking-widest">Sponsored Advertisement</span>
        <span className="text-[9px] font-mono">Adsterra Ad</span>
      </div>
      <div
        ref={containerRef}
        className="w-[300px] h-[250px] flex items-center justify-center bg-neutral-50 rounded-xl overflow-hidden border border-neutral-100"
      />
    </div>
  );
}
