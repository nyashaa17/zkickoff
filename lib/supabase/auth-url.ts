/**
 * ZimKickOff — Trusted Supabase Auth URL & Redirect Resolver
 *
 * Guarantees:
 * - Production recovery and callback URLs strictly target the trusted production origin.
 * - Prevents localhost or development URLs from leaking into production emails.
 * - Prevents arbitrary forwarded host headers from creating open redirects or poisoning recovery flows.
 * - Preserves safe local development support on localhost/127.0.0.1.
 */

export const TRUSTED_PRODUCTION_ORIGIN = 'https://zimkickoff.co.zw';

/**
 * Resolves the trusted origin for constructing authentication redirects.
 */
export function getTrustedAuthOrigin(): string {
  // 1. Explicit configured production site URL environment variable
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl && configuredSiteUrl.startsWith('https://')) {
    return configuredSiteUrl.replace(/\/+$/, '');
  }

  // 2. Client-side browser validation
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const hostname = window.location.hostname;

    // Production domain verification
    if (hostname === 'zimkickoff.co.zw' || hostname.endsWith('.zimkickoff.co.zw')) {
      return origin;
    }

    // Local development isolation (strictly non-production)
    if (
      process.env.NODE_ENV !== 'production' &&
      (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost'))
    ) {
      return origin;
    }
  }

  // 3. Production fallback (never default to localhost in production)
  return TRUSTED_PRODUCTION_ORIGIN;
}

/**
 * Builds the canonical auth callback redirect URL for password recovery.
 */
export function getAuthCallbackRedirectUrl(nextPath: string = '/admin/reset-password'): string {
  const origin = getTrustedAuthOrigin();
  const safeNext =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') && !nextPath.includes('\\')
      ? nextPath
      : '/admin/reset-password';

  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
