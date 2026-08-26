/**
 * Bzzoiro Sports Data API integration
 * Leverages the BSD image proxy and v2 search endpoints
 * All queries are safely cached to improve loading times.
 */

import sharp from 'sharp';

const teamIdCache = new Map<string, string | null>();
const leagueIdCache = new Map<string, string | null>();

// High-fidelity preseeded records for zero-latency initial rendering of top clubs
const COMMON_TEAM_IDS: Record<string, string> = {
  // English Premier League
  'arsenal': '18',
  'chelsea': '13',
  'manchester united': '17',
  'man utd': '17',
  'liverpool': '1',
  'manchester city': '12',
  'man city': '12',
  'tottenham': '9',
  'spurs': '9',
  'aston villa': '3',
  'newcastle': '4',
  'everton': '20',
  'west ham': '8',
  'brentford': '16',
  'fulham': '6',
  'bournemouth': '2',
  'crystal palace': '14',
  'wolves': '11',
  'wolverhampton': '11',
  'brighton': '5',
  'nottingham forest': '15',
  'leicester': '221',
  'ipswich': '200',
  'southampton': '205',

  // La Liga (Spain)
  'real madrid': '57',
  'barcelona': '44',
  'fc barcelona': '44',
  'atletico madrid': '54',
  'atletico': '54',
  'valencia': '47',
  'sevilla': '52',
  'girona': '39',
  'real sociedad': '48',

  // Serie A (Italy)
  'juventus': '73',
  'ac milan': '63',
  'milan': '63',
  'inter milan': '77',
  'inter': '77',
  'roma': '65',
  'napoli': '840',
  'lazio': '70',
  'atalanta': '71',
  'fiorentina': '68',

  // Bundesliga (Germany)
  'bayern munich': '1394',
  'bayern': '1394',
  'borussia dortmund': '92',
  'dortmund': '92',
  'bayer leverkusen': '85',
  'leverkusen': '85',
  'rb leipzig': '1857',
  'leipzig': '1857',
  'stuttgart': '84',

  // Ligue 1 (France)
  'psg': '114',
  'paris saint germain': '114',
  'paris saint-germain': '114',
  'marseille': '98',
  'monaco': '101',
  'lille': '106',
  'lyon': '1614',
  'nice': '103',

  // Zimbabwe ZPSL & National
  'dynamos': '595',
  'dynamos fc': '595',
  'highlanders fc': '102',
  'highlanders': '102',

  // Saudi Pro League
  'al nassr': '812',
  'al-nassr': '812',
  'al hilal': '778',
  'al-hilal': '778',
  'al ittihad': '807',
  'al-ittihad': '807',
  'al ahli': '804',
  'al-ahli': '804',
  'al khaleej': '817',
  'al-khaleej': '817',
  'al ettifaq': '814',
  'al-ettifaq': '814',
  'al shabab': '780',
  'al-shabab': '780',
};

const COMMON_LEAGUE_IDS: Record<string, string> = {
  'english premier league': '1',
  'premier league': '1',
  'la liga': '3',
  'la liga santander': '3',
  'laliga': '3',
  'primera division': '3',
  'serie a': '4',
  'bundesliga': '5',
  'ligue 1': '6',
  'champions league': '7',
  'uefa champions league': '7',
  'europa league': '8',
  'uefa europa league': '8',
  'championship': '12',
  'efl championship': '12',
  'saudi pro league': '17',
  'mls': '18',
  'major league soccer': '18',
  'brasileirao': '9',
  'brasileirão': '9',
  'eredivisie': '10',
  'liga portugal': '2',
  'scottish premiership': '13',
  'caf champions league': '29',
  'j1 league': '49',
  'j-league': '49',
  'j.league': '49',
  'zimbabwe premier soccer league': '45',
  'zimbabwe: premier soccer league': '45',
  'zpsl': '45',
  'caf world cup qualifiers': '10'
};

function matchIdByTokens(
  normalizedInput: string,
  dict: Record<string, string>
): string | undefined {
  // Exact match takes absolute priority
  if (dict[normalizedInput]) return normalizedInput;

  const inputTokens = normalizedInput.split(/\s+/).filter(Boolean);
  const genericWords = new Set(['united', 'city', 'town', 'athletic', 'rovers', 'fc', 'sport', 'real', 'cf', 'sc', 'club', 'de', 'the', 'afc']);
  const meaningfulInputTokens = inputTokens.filter(t => !genericWords.has(t) && t.length > 1);

  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const key of sortedKeys) {
    const keyTokens = key.split(/\s+/).filter(Boolean);

    // Strategy 1: Every token in the key appears as a whole word in the input
    const allKeyTokensInInput = keyTokens.every(kt => inputTokens.includes(kt));
    if (allKeyTokensInInput) {
      // Guard: if key has fewer meaningful tokens than input, it might be
      // too ambiguous (e.g. key "inter" matching "inter miami").
      // Require that key tokens cover ALL meaningful input tokens, OR
      // that the key has at least as many tokens as the meaningful input.
      const keyMeaningful = keyTokens.filter(t => !genericWords.has(t) && t.length > 1);
      const uncoveredInputTokens = meaningfulInputTokens.filter(t => !keyTokens.includes(t));
      
      // Only accept if there are no significant uncovered tokens in the input
      if (uncoveredInputTokens.length === 0) {
        const score = 100 + keyTokens.length * 10 + key.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = key;
        }
      }
    }

    // Strategy 2: Input tokens are a subset of key tokens (reverse containment)
    // For short aliases: input="inter" matching key="inter milan"
    if (normalizedInput.length >= 4 && meaningfulInputTokens.length > 0) {
      const allMeaningfulInKey = meaningfulInputTokens.every(it => keyTokens.includes(it));
      if (allMeaningfulInKey) {
        const uncoveredKeyTokens = keyTokens.filter(kt => !genericWords.has(kt) && !inputTokens.includes(kt));
        // Accept reverse containment, but with lower priority
        const score = 50 + meaningfulInputTokens.length * 5 + key.length - uncoveredKeyTokens.length * 3;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = key;
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Resolves properties to a static team logo image URL via Bzzoiro Sports Data proxy
 */
export async function getTeamLogoUrl(teamName: string): Promise<string | undefined> {
  const normalizedKey = teamName.toLowerCase().trim();
  
  // 1. Check pre-seeded known team IDs to avoid unnecessary network latency
  const matchedTeamKey = matchIdByTokens(normalizedKey, COMMON_TEAM_IDS);

  if (matchedTeamKey) {
    return `https://sports.bzzoiro.com/img/team/${COMMON_TEAM_IDS[matchedTeamKey]}`;
  }
  
  // 2. Check runtime in-memory cache (including negative cache entries)
  if (teamIdCache.has(normalizedKey)) {
    const cachedId = teamIdCache.get(normalizedKey);
    return cachedId ? `https://sports.bzzoiro.com/img/team/${cachedId}` : undefined;
  }

  // 3. Fallback to API query if BZZOIRO_API_KEY is available
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    teamIdCache.set(normalizedKey, null); // Negative cache
    return undefined;
  }

  try {
    const url = `https://sports.bzzoiro.com/api/v2/teams/?name=${encodeURIComponent(teamName)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000),
      cache: 'force-cache'
    });

    if (response.ok) {
      const data = await response.json();
      let teamId: string | null = null;

      if (data && Array.isArray(data.results) && data.results.length > 0) {
        teamId = String(data.results[0].id);
      } else if (data && Array.isArray(data) && data.length > 0) {
        teamId = String(data[0].id);
      }

      if (teamId) {
        teamIdCache.set(normalizedKey, teamId);
        return `https://sports.bzzoiro.com/img/team/${teamId}`;
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError' && err.name !== 'TimeoutError') {
      console.error(`Bzzoiro API team lookup error for '${teamName}':`, err);
    }
  }

  teamIdCache.set(normalizedKey, null); // Negative cache so we don't repeat failed requests
  return undefined;
}

/**
 * Resolves properties to a static league banner logo shield image URL via the Bzzoiro Sports Data proxy
 */
export async function getLeagueLogoUrl(leagueName: string): Promise<string | undefined> {
  const normalizedKey = leagueName.toLowerCase().trim();

  // 1. Check common pre-seeded league ID mappings
  const matchedKey = matchIdByTokens(normalizedKey, COMMON_LEAGUE_IDS);
  if (matchedKey) {
    return `https://sports.bzzoiro.com/img/league/${COMMON_LEAGUE_IDS[matchedKey]}`;
  }

  // 2. Check in-memory cache (including negative cache entries)
  if (leagueIdCache.has(normalizedKey)) {
    const cachedId = leagueIdCache.get(normalizedKey);
    return cachedId ? `https://sports.bzzoiro.com/img/league/${cachedId}` : undefined;
  }

  // 3. Request search from the API
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) {
    leagueIdCache.set(normalizedKey, null); // Negative cache
    return undefined;
  }

  try {
    const url = `https://sports.bzzoiro.com/api/v2/leagues/?country=${encodeURIComponent(leagueName)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(3000),
      cache: 'force-cache'
    });

    if (response.ok) {
      const data = await response.json();
      let leagueId: string | null = null;

      if (data && Array.isArray(data.results)) {
        const found = data.results.find((l: any) => l.name?.toLowerCase().includes(normalizedKey)) || data.results[0];
        if (found) leagueId = String(found.id);
      } else if (data && Array.isArray(data)) {
        const found = data.find((l: any) => l.name?.toLowerCase().includes(normalizedKey)) || data[0];
        if (found) leagueId = String(found.id);
      }

      if (leagueId) {
        leagueIdCache.set(normalizedKey, leagueId);
        return `https://sports.bzzoiro.com/img/league/${leagueId}`;
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError' && err.name !== 'TimeoutError') {
      console.error(`Bzzoiro API league lookup error for '${leagueName}':`, err);
    }
  }

  leagueIdCache.set(normalizedKey, null); // Negative cache
  return undefined;
}

/**
 * Pre-fetches and validates team logo image bytes for OG image generation.
 * Returns a base64 Data URL if the image is valid (PNG, JPEG, SVG > 100 bytes),
 * or undefined on any error/timeout/404, ensuring ImageResponse / Satori never crashes.
 *
 * Raster images (PNG, JPEG) are piped through sharp to normalize to 8-bit RGBA PNG,
 * which fixes CMYK JPEGs, 16-bit PNGs, interlaced PNGs, and other encoding variants
 * that pass magic-byte validation but crash Satori's resvg compositor.
 */
export async function safeGetOgLogo(teamName: string): Promise<string | undefined> {
  try {
    const logoUrl = await getTeamLogoUrl(teamName);
    if (!logoUrl) return undefined;

    const res = await fetch(logoUrl, {
      signal: AbortSignal.timeout(2500),
      redirect: 'follow',
      headers: {
        'Accept': 'image/png,image/jpeg,image/webp,image/*;q=0.8',
      },
    });

    if (!res.ok) return undefined;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return undefined;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) return undefined;

    // Validate magic header bytes — Satori only supports PNG, JPEG, SVG (WebP causes Satori crash)
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isSvg = buffer.subarray(0, 100).toString().includes('<svg');

    if (!isPng && !isJpg && !isSvg) {
      return undefined;
    }

    // SVGs pass through as-is — resvg renders SVG natively
    if (isSvg) {
      return `data:image/svg+xml;base64,${buffer.toString('base64')}`;
    }

    // Normalize raster images to 8-bit RGBA PNG via sharp.
    // This handles CMYK JPEGs, 16-bit PNGs, interlaced PNGs, and other
    // encoding variants that Satori/resvg cannot composite.
    try {
      const normalizedBuffer = await sharp(buffer)
        .png()
        .toBuffer();
      return `data:image/png;base64,${normalizedBuffer.toString('base64')}`;
    } catch {
      // sharp decode failure — image is corrupt or uses an unsupported codec.
      // Fall back to undefined so the initial-letter fallback renders instead.
      return undefined;
    }
  } catch {
    return undefined;
  }
}

