"use client";

import { useEffect } from "react";

export function DelayedVignetteAd() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const script = document.createElement("script");
      script.dataset.zone = "11055245";
      script.src = "https://n6wxm.com/vignette.min.js";
      document.body.appendChild(script);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
