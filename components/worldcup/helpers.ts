export async function getWorldCupLeagueId(): Promise<string | null> {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) return null;

  try {
    // Fetch active leagues list. Using limit=150 ensures we get all leagues
    // securely without depending on query searches.
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/leagues/?limit=150`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });
    
    if (res.ok) {
      const data = await res.json();
      const results = data.results || data || [];
      if (Array.isArray(results)) {
        // Find the most appropriate World Cup 2026 or generic World Cup league
        // Look for ones that are primarily for the main World Cup (not Qualifiers or Women's)
        const wc = results.find((l: any) => l.name && l.name.toLowerCase().includes('world cup') && !l.name.toLowerCase().includes('qualifi') && !l.name.toLowerCase().includes('women'));
        if (wc) return String(wc.id);
        
        // fallback to first if any matched
        const fallback = results.find((l: any) => l.name && l.name.toLowerCase().includes('world cup') && !l.name.toLowerCase().includes('women'));
        if (fallback) return String(fallback.id);

        const anyFallback = results.find((l: any) => l.name && l.name.toLowerCase().includes('world cup'));
        if (anyFallback) return String(anyFallback.id);
      }
    }
  } catch (err) {
    console.error("Error looking up World Cup League ID:", err);
  }
  return null;
}

export async function getWorldCupTeamsMap(): Promise<Record<number, string>> {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) return {};

  const leagueId = await getWorldCupLeagueId();
  if (!leagueId) return {};

  try {
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/teams/?league_id=${leagueId}&limit=120`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });
    
    if (res.ok) {
      const data = await res.json();
      const results = data.results || data || [];
      const map: Record<number, string> = {};
      if (Array.isArray(results)) {
        results.forEach((team: any) => {
          if (team.id && team.name) {
            map[team.id] = team.name;
          }
        });
      }
      return map;
    }
  } catch (err) {
    console.error("Error looking up World Cup Teams Map:", err);
  }
  return {};
}

export async function getWorldCupTeams(): Promise<any[]> {
  const apiKey = process.env.BZZOIRO_API_KEY;
  if (!apiKey) return [];

  const leagueId = await getWorldCupLeagueId();
  if (!leagueId) return [];

  try {
    const res = await fetch(`https://sports.bzzoiro.com/api/v2/teams/?league_id=${leagueId}&limit=120`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json'
      },
      next: { revalidate: 86400 } // Cache for 24 hours
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.results || data || [];
    }
  } catch (err) {
    console.error("Error fetching World Cup Teams:", err);
  }
  return [];
}

// Map country names to ISO 3166-1 alpha-2 codes for flagging/logo CDNs
export const countriesMap: Record<string, string> = {
  // A
  "afghanistan": "af", "albania": "al", "algeria": "dz", "andorra": "ad", "angola": "ao", "antigua and barbuda": "ag", "argentina": "ar", "armenia": "am", "australia": "au", "austria": "at", "azerbaijan": "az",
  // B
  "bahamas": "bs", "bahrain": "bh", "bangladesh": "bd", "barbados": "bb", "belarus": "by", "belgium": "be", "belize": "bz", "benin": "bj", "bhutan": "bt", "bolivia": "bo", "bosnia and herzegovina": "ba", "botswana": "bw", "brazil": "br", "brunei": "bn", "bulgaria": "bg", "burkina faso": "bf", "burundi": "bi",
  // C
  "cabo verde": "cv", "cape verde": "cv", "cambodia": "kh", "cameroon": "cm", "canada": "ca", "central african republic": "cf", "chad": "td", "chile": "cl", "china": "cn", "colombia": "co", "comoros": "km", "congo": "cg", "dr congo": "cd", "democratic republic of congo": "cd", "democratic republic of the congo": "cd", "costa rica": "cr", "croatia": "hr", "cuba": "cu", "cyprus": "cy", "czech republic": "cz", "czechia": "cz",
  // D-E-F
  "denmark": "dk", "djibouti": "dj", "dominica": "dm", "dominican republic": "do", "ecuador": "ec", "egypt": "eg", "el salvador": "sv", "england": "gb-eng", "equatorial guinea": "gq", "eritrea": "er", "estonia": "ee", "eswatini": "sz", "ethiopia": "et", "fiji": "fj", "finland": "fi", "france": "fr",
  // G-H-I
  "gabon": "ga", "gambia": "gm", "georgia": "ge", "germany": "de", "ghana": "gh", "greece": "gr", "grenada": "gd", "guatemala": "gt", "guinea": "gn", "guinea-bissau": "gw", "guyana": "gy", "haiti": "ht", "honduras": "hn", "hungary": "hu", "iceland": "is", "india": "in", "indonesia": "id", "iran": "ir", "iraq": "iq", "ireland": "ie", "republic of ireland": "ie", "israel": "il", "italy": "it", "ivory coast": "ci", "cote d'ivoire": "ci",
  // J-K-L
  "jamaica": "jm", "japan": "jp", "jordan": "jo", "kazakhstan": "kz", "kenya": "ke", "kiribati": "ki", "north korea": "kp", "south korea": "kr", "korea republic": "kr", "kuwait": "kw", "kyrgyzstan": "kg", "laos": "la", "latvia": "lv", "lebanon": "lb", "lesotho": "ls", "liberia": "lr", "libya": "ly", "liechtenstein": "li", "lithuania": "lt", "luxembourg": "lu",
  // M
  "madagascar": "mg", "malawi": "mw", "malaysia": "my", "maldives": "mv", "mali": "ml", "malta": "mt", "mauritania": "mr", "mauritius": "mu", "mexico": "mx", "moldova": "md", "monaco": "mc", "mongolia": "mn", "montenegro": "me", "morocco": "ma", "mozambique": "mz", "myanmar": "mm",
  // N-O-P
  "namibia": "na", "nepal": "np", "netherlands": "nl", "new zealand": "nz", "nicaragua": "ni", "niger": "ne", "nigeria": "ng", "north macedonia": "mk", "norway": "no", "oman": "om", "pakistan": "pk", "palestine": "ps", "panama": "pa", "papua new guinea": "pg", "paraguay": "py", "peru": "pe", "philippines": "ph", "poland": "pl", "portugal": "pt",
  // Q-R-S
  "qatar": "qa", "romania": "ro", "russia": "ru", "rwanda": "rw", "samoa": "ws", "san marino": "sm", "saudi arabia": "sa", "scotland": "gb-sct", "senegal": "sn", "serbia": "rs", "seychelles": "sc", "sierra leone": "sl", "singapore": "sg", "slovakia": "sk", "slovenia": "si", "solomon islands": "sb", "somalia": "so", "south africa": "za", "spain": "es", "sri lanka": "lk", "sudan": "sd", "suriname": "sr", "sweden": "se", "switzerland": "ch", "syria": "sy",
  // T-U-V-W-Y-Z
  "taiwan": "tw", "tajikistan": "tj", "tanzania": "tz", "thailand": "th", "togo": "tg", "tonga": "to", "trinidad and tobago": "tt", "tunisia": "tn", "turkey": "tr", "turkiye": "tr", "turkmenistan": "tm", "uganda": "ug", "ukraine": "ua", "united arab emirates": "ae", "united kingdom": "gb", "united states": "us", "usa": "us", "uruguay": "uy", "uzbekistan": "uz", "vanuatu": "vu", "venezuela": "ve", "vietnam": "vn", "wales": "gb-wls", "yemen": "ye", "zambia": "zm", "zimbabwe": "zw"
};

export function getTeamFlagUrl(teamName: string): string | null {
  if (!teamName) return null;
  const name = teamName.toLowerCase().trim();
  const code = countriesMap[name];
  if (code) {
    return `https://flagcdn.com/w80/${code}.png`;
  }
  return null;
}

