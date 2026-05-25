'use client';

import React, { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  name: string;
  className?: string;
  bzzBadge?: string | null;
  lsBadge?: string | null;
}

const COMMON_ABBREVIATIONS: Record<string, string> = {
  'psg': 'paris saint-germain',
  'paris sg': 'paris saint-germain',
  'man utd': 'manchester united',
  'man city': 'manchester city',
  'spurs': 'tottenham hotspur',
  'tottenham': 'tottenham hotspur',
  'bayern': 'bayern munich',
  'leipzig': 'rb leipzig',
  'leverkusen': 'bayer leverkusen',
  'gladbach': 'borussia monchengladbach',
  'milan': 'ac milan',
  'inter': 'inter milan',
  'atletico': 'atletico madrid',
  'bilbao': 'athletic club',
  'sociedad': 'real sociedad',
  'wolves': 'wolverhampton wanderers',
  'sporting': 'sporting cp',
  'benfica': 'sl benfica',
  'porto': 'fc porto',
};

function getFuzzyLogoUrl(teamName?: string, allLogos?: Record<string, string> | null): string | null {
  if (!teamName || !allLogos) return null;
  const nameLower = teamName.toLowerCase().trim();
  const keys = Object.keys(allLogos);

  // 1. Check direct / exact match
  let foundKey = keys.find(k => k.toLowerCase().trim() === nameLower);
  if (foundKey) return allLogos[foundKey];

  // 2. Expand common abbreviations
  const expandedName = COMMON_ABBREVIATIONS[nameLower];
  if (expandedName) {
    foundKey = keys.find(k => k.toLowerCase().trim() === expandedName);
    if (foundKey) return allLogos[foundKey];
  }

  // 3. Substring containment match
  foundKey = keys.find(k => {
    const kLower = k.toLowerCase().trim();
    return kLower.includes(nameLower) || nameLower.includes(kLower);
  });
  if (foundKey) return allLogos[foundKey];

  // 4. Token match - match if they share a unique token (excluding stop words)
  const stopWords = ['fc', 'f.c.', 'united', 'city', 'town', 'athletic', 'rovers', 'sport', 'real', 'cf', 'club', 'de'];
  const getTokens = (str: string) => 
    str.toLowerCase()
       .replace(/[^a-z0-9]/g, ' ')
       .split(/\s+/)
       .filter(t => t.length > 2 && !stopWords.includes(t));

  const nameTokens = getTokens(teamName);
  if (nameTokens.length > 0) {
    // Exact word token match
    foundKey = keys.find(k => {
      const kTokens = getTokens(k);
      return nameTokens.some(nt => kTokens.includes(nt));
    });
    if (foundKey) return allLogos[foundKey];
  }

  // 5. Check if any word token is a partial match
  if (nameTokens.length > 0) {
    foundKey = keys.find(k => {
      const kTokens = getTokens(k);
      return nameTokens.some(nt => kTokens.some(kt => kt.includes(nt) || nt.includes(kt)));
    });
    if (foundKey) return allLogos[foundKey];
  }

  return null;
}

function SoccerFieldShield({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-emerald-50 border border-emerald-200", className)}>
      <svg className="w-[65%] h-[65%] text-[#009739]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(0,151,57,0.12)" stroke="#009739" strokeWidth="1.5" />
        <circle cx="12" cy="11" r="3" stroke="#009739" strokeWidth="1.2" />
        <path d="M12 2v18" stroke="#009739" strokeWidth="1" strokeDasharray="1 1" />
      </svg>
    </div>
  );
}

export function TeamLogo({ name, className, bzzBadge, lsBadge }: TeamLogoProps) {
  const [bzzError, setBzzError] = useState(false);
  const [lsError, setLsError] = useState(false);
  const [githubError, setGithubError] = useState(false);

  // Fetch the github-all-logos mapping
  const { data: allLogos } = useSWR<Record<string, string>>('github-all-logos', () => 
    fetch('https://raw.githubusercontent.com/Vicecap/Myfixture/main/all_logos.json')
      .then(res => res.json())
  );

  const matchedGithubLogoUrl = React.useMemo(() => {
    return getFuzzyLogoUrl(name, allLogos);
  }, [name, allLogos]);

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

  // Try GitHub fuzzy matched logo next
  if (matchedGithubLogoUrl && !githubError) {
    return (
      <img 
        src={matchedGithubLogoUrl} 
        alt={name} 
        className={cn("rounded-full object-contain shrink-0", className)} 
        onError={() => setGithubError(true)} 
      />
    );
  }

  // Ultimate fallback to Chessboard/Soccer custom Shield vector to remove initials entirely
  return <SoccerFieldShield className={className} />;
}
