'use client';

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  name: string;
  className?: string;
  bzzBadge?: string | null;
  lsBadge?: string | null;
}

export function TeamLogo({ name, className, bzzBadge, lsBadge }: TeamLogoProps) {
  const [bzzError, setBzzError] = useState(false);
  const [lsError, setLsError] = useState(false);

  const initials = name?.substring(0, 3).toUpperCase() || "T";
  const defaultClass = cn(
    "rounded-full bg-gray-200 flex items-center justify-center font-bold border border-gray-300 shadow-sm overflow-hidden shrink-0", 
    className
  );

  // Try Bzzoiro badge first
  if (bzzBadge && !bzzError) {
    return (
      <img 
        src={bzzBadge} 
        alt={name} 
        className={cn("rounded-full object-contain shrink-0", className)} 
        onError={() => setBzzError(true)} 
      />
    );
  }

  // Try Livescore badge next
  if (lsBadge && !lsError) {
    return (
      <img 
        src={lsBadge} 
        alt={name} 
        className={cn("rounded-full object-contain shrink-0", className)} 
        onError={() => setLsError(true)} 
      />
    );
  }

  // Fallback to initials
  return (
    <div className={defaultClass}>
      <span className="text-[10px] sm:text-xs tracking-tighter text-gray-600 font-mono leading-none">{initials}</span>
    </div>
  );
}
