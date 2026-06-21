"use client";

import React, { useEffect, useRef, useState } from "react";

export function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

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

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] border-none shadow-2xl bg-transparent">
      <div className="relative inline-block">
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute -top-3 -right-3 z-10 w-6 h-6 flex justify-center items-center bg-black hover:bg-neutral-800 text-white rounded-full text-[10px] font-bold cursor-pointer transition-colors shadow-lg border-2 border-white"
          aria-label="Close Ad"
        >
          ✕
        </button>
        <div
          ref={containerRef}
          className="w-[300px] h-[250px] bg-transparent overflow-hidden rounded-none border-none pointer-events-auto"
        />
      </div>
    </div>
  );
}
