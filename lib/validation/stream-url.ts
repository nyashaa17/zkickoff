/**
 * ZimKickOff — Syntactic Stream URL Validation and Anti-SSRF Normalizer
 *
 * Rules:
 * - Purely syntactic validation — NEVER issues server-side network requests.
 * - YouTube URLs: normalized to canonical https://www.youtube.com/watch?v={videoId}.
 * - HLS URLs: requires HTTPS; strictly rejects localhost, private RFC 1918,
 *   cloud metadata, multicast, alternative IP representations, and credentials.
 */

const FORBIDDEN_NAMED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  'metadata',
]);

/**
 * Checks if a string or number can represent an alternative numeric IP
 * (e.g. integer, octal, hex) and converts it to a standard 32-bit unsigned integer if so.
 */
function parseIpv4ToNumber(host: string): number | null {
  // Dotted notation (can have 1 to 4 parts with dec/hex/octal)
  const parts = host.split('.');
  if (parts.length > 4) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    if (part === '') return null;
    let num: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      num = parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      num = parseInt(part, 8);
    } else if (/^\d+$/.test(part)) {
      num = parseInt(part, 10);
    } else {
      return null;
    }
    if (isNaN(num) || num < 0) return null;
    numbers.push(num);
  }

  let ipNum: number;
  if (numbers.length === 1) {
    // Single 32-bit number e.g. 2130706433
    ipNum = numbers[0];
  } else if (numbers.length === 2) {
    if (numbers[0] > 0xff || numbers[1] > 0xffffff) return null;
    ipNum = (numbers[0] << 24) | numbers[1];
  } else if (numbers.length === 3) {
    if (numbers[0] > 0xff || numbers[1] > 0xff || numbers[2] > 0xffff) return null;
    ipNum = (numbers[0] << 24) | (numbers[1] << 16) | numbers[2];
  } else if (numbers.length === 4) {
    if (numbers.some((n) => n > 0xff)) return null;
    ipNum = ((numbers[0] << 24) | (numbers[1] << 16) | (numbers[2] << 8) | numbers[3]) >>> 0;
  } else {
    return null;
  }

  return (ipNum >>> 0);
}

/**
 * Validates whether a 32-bit integer IPv4 address falls within a prohibited range.
 */
function isProhibitedIpv4Number(ip: number): boolean {
  const b1 = (ip >>> 24) & 0xff;
  const b2 = (ip >>> 16) & 0xff;

  // 0.0.0.0/8 (Broadcast/Current network)
  if (b1 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b1 === 10) return true;

  // 100.64.0.0/10 (Carrier Grade NAT RFC 6598: 100.64.0.0 – 100.127.255.255)
  if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (b1 === 127) return true;

  // 169.254.0.0/16 (Link-Local / Cloud Metadata e.g. 169.254.169.254)
  if (b1 === 169 && b2 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 – 172.31.255.255)
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b1 === 192 && b2 === 168) return true;

  // 198.18.0.0/15 (Benchmarking RFC 2544)
  if (b1 === 198 && (b2 === 18 || b2 === 19)) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 – 239.255.255.255)
  if (b1 >= 224 && b1 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use)
  if (b1 >= 240) return true;

  return false;
}

/**
 * Validates an IPv6 address against private, loopback, link-local, and mapped IPv4 ranges.
 */
function isProhibitedIpv6(host: string): boolean {
  const clean = host.replace(/[\[\]]/g, '').toLowerCase();

  // Loopback
  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1') return true;
  if (clean === '::' || clean === '0:0:0:0:0:0:0:0') return true;

  // Link-local: fe80::/10 (fe8, fe9, fea, feb)
  if (/^fe[89ab][0-9a-f]:/i.test(clean)) return true;

  // Unique local: fc00::/7 (fc, fd)
  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) return true;

  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const mappedMatch = clean.match(/(?:^|:)ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mappedMatch) {
    const ipNum = parseIpv4ToNumber(mappedMatch[1]);
    if (ipNum !== null && isProhibitedIpv4Number(ipNum)) return true;
  }

  // Hexadecimal IPv4 mapped: ::ffff:7f00:1
  if (clean.startsWith('::ffff:')) {
    const trailing = clean.replace('::ffff:', '');
    if (!trailing.includes('.')) {
      // Possible hex representation of IPv4
      const parts = trailing.split(':');
      if (parts.length === 2) {
        const hex = parts[0].padStart(4, '0') + parts[1].padStart(4, '0');
        const num = parseInt(hex, 16);
        if (!isNaN(num) && isProhibitedIpv4Number(num)) return true;
      }
    }
  }

  return false;
}

/**
 * Validates and normalizes YouTube stream inputs.
 * Accepts raw 11-char video ID, standard watch URL, embed URL, live URL, or youtu.be shortlink.
 * Returns canonical https://www.youtube.com/watch?v={id}.
 */
export function validateAndNormalizeYouTubeUrl(rawInput: string): string {
  const trimmed = rawInput.trim();

  // Pattern 1: Raw 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid YouTube stream URL syntax.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('YouTube stream URL must use http or https.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credentials embedded in YouTube stream URLs are prohibited.');
  }

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  let videoId: string | null = null;

  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/live/')) {
      videoId = parsed.pathname.slice('/live/'.length).split('/')[0] || null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.slice('/embed/'.length).split('/')[0] || null;
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.slice('/shorts/'.length).split('/')[0] || null;
    } else if (parsed.pathname.startsWith('/v/')) {
      videoId = parsed.pathname.slice('/v/'.length).split('/')[0] || null;
    }
  } else if (host === 'youtu.be') {
    videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error('Could not extract a valid 11-character YouTube video ID from URL.');
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Validates and normalizes HLS manifest inputs.
 * Requires secure HTTPS, blocks non-public IP ranges, cloud metadata, and malformed hosts.
 */
export function validateAndNormalizeHlsUrl(rawInput: string): string {
  const trimmed = rawInput.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid HLS stream URL syntax.');
  }

  // HLS sources must strictly use secure HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error('HLS stream URL must use secure HTTPS protocol.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Credentials embedded in stream URLs are prohibited.');
  }

  const rawHost = parsed.hostname.toLowerCase().replace(/\.+$/, '');

  if (!rawHost) {
    throw new Error('Stream URL hostname cannot be empty.');
  }

  // Block localhost and metadata names
  if (FORBIDDEN_NAMED_HOSTS.has(rawHost) || rawHost.endsWith('.localhost') || rawHost.endsWith('.local') || rawHost.endsWith('.internal')) {
    throw new Error('Prohibited local, internal, or cloud metadata hostname rejected.');
  }

  // Reject single-word non-FQDN hostnames (e.g. http://server/)
  if (!rawHost.includes('.') && !rawHost.includes(':')) {
    throw new Error('Stream URL must use a fully qualified domain name.');
  }

  // IPv6 check
  if (rawHost.includes(':')) {
    if (isProhibitedIpv6(rawHost)) {
      throw new Error('Prohibited private, loopback, or link-local IPv6 address.');
    }
    return parsed.toString();
  }

  // IPv4 & numeric notation check
  const ipNum = parseIpv4ToNumber(rawHost);
  if (ipNum !== null) {
    if (isProhibitedIpv4Number(ipNum)) {
      throw new Error('Prohibited private, loopback, or link-local IPv4 address.');
    }
  }

  return parsed.toString();
}

/**
 * Unified stream URL validator and normalizer.
 * Dispatches according to stream_type ('youtube' | 'hls').
 */
export function normalizeAndValidateStreamUrl(rawUrl: string, type: 'youtube' | 'hls'): string {
  if (type === 'youtube') {
    return validateAndNormalizeYouTubeUrl(rawUrl);
  }
  if (type === 'hls') {
    return validateAndNormalizeHlsUrl(rawUrl);
  }
  throw new Error(`Unsupported stream type: ${type}`);
}
