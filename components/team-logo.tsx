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

// Shared module-level index and lookup cache across all TeamLogo instances
interface LogoIndexState {
  exactMap: Map<string, string>;
  tokenMap: Map<string, string>;
  allKeys: string[];
  sourceRef: Record<string, string> | null;
}

const logoIndexState: LogoIndexState = {
  exactMap: new Map(),
  tokenMap: new Map(),
  allKeys: [],
  sourceRef: null,
};

const resolutionCache = new Map<string, string | null>();
const STOP_WORDS = new Set(['fc', 'f.c.', 'united', 'city', 'town', 'athletic', 'rovers', 'sport', 'real', 'cf', 'club', 'de', 'the', 'sc', 'ac']);

function buildLogoIndex(allLogos: Record<string, string>) {
  if (logoIndexState.sourceRef === allLogos) return;

  logoIndexState.exactMap.clear();
  logoIndexState.tokenMap.clear();
  logoIndexState.allKeys = [];
  resolutionCache.clear();

  for (const [key, url] of Object.entries(allLogos)) {
    const normKey = key.toLowerCase().trim();
    logoIndexState.exactMap.set(normKey, url);
    logoIndexState.allKeys.push(normKey);

    const tokens = normKey
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    for (const token of tokens) {
      if (!logoIndexState.tokenMap.has(token)) {
        logoIndexState.tokenMap.set(token, url);
      }
    }
  }

  logoIndexState.sourceRef = allLogos;
}

function getFuzzyLogoUrl(teamName?: string, allLogos?: Record<string, string> | null): string | null {
  if (!teamName || !allLogos) return null;

  const norm = teamName.toLowerCase().trim();
  if (resolutionCache.has(norm)) {
    return resolutionCache.get(norm) ?? null;
  }

  buildLogoIndex(allLogos);

  // 1. Direct exact match in indexed Map (O(1))
  let url = logoIndexState.exactMap.get(norm);
  if (url) {
    resolutionCache.set(norm, url);
    return url;
  }

  // 2. Expand common abbreviations (O(1))
  const expandedName = COMMON_ABBREVIATIONS[norm];
  if (expandedName) {
    url = logoIndexState.exactMap.get(expandedName);
    if (url) {
      resolutionCache.set(norm, url);
      return url;
    }
  }

  // 3. Meaningful unique token match (O(1))
  const nameTokens = norm
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  for (const token of nameTokens) {
    url = logoIndexState.tokenMap.get(token);
    if (url) {
      resolutionCache.set(norm, url);
      return url;
    }
  }

  // 4. Substring fallback over indexed keys
  for (let i = 0; i < logoIndexState.allKeys.length; i++) {
    const k = logoIndexState.allKeys[i];
    if (k.includes(norm) || norm.includes(k)) {
      url = logoIndexState.exactMap.get(k);
      if (url) {
        resolutionCache.set(norm, url);
        return url;
      }
    }
  }

  resolutionCache.set(norm, null);
  return null;
}

function SoccerFieldShield({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-neutral-100 border border-neutral-300", className)}>
      <svg className="w-[65%] h-[65%] text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(0,0,0,0.08)" stroke="#000000" strokeWidth="1.5" />
        <circle cx="12" cy="11" r="3" stroke="#000000" strokeWidth="1.2" />
        <path d="M12 2v18" stroke="#000000" strokeWidth="1" strokeDasharray="1 1" />
      </svg>
    </div>
  );
}

export function TeamLogo({ name, className, bzzBadge, lsBadge }: TeamLogoProps) {
  const [bzzError, setBzzError] = useState(false);
  const [lsError, setLsError] = useState(false);
  const [githubError, setGithubError] = useState(false);

  // Fetch the github-all-logos mapping (deduplicated by SWR)
  const { data: allLogos } = useSWR<Record<string, string>>('github-all-logos', () => 
    fetch('https://raw.githubusercontent.com/Vicecap/Myfixture/main/all_logos.json')
      .then(res => res.json()),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 3600000,
    }
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

  // Ultimate fallback to Soccer Shield vector
  return <SoccerFieldShield className={className} />;
}
