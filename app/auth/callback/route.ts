import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { type EmailOtpType } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getTrustedAuthOrigin } from '@/lib/supabase/auth-url';

export const dynamic = 'force-dynamic';

export const ALLOWED_OTP_TYPES: EmailOtpType[] = ['invite', 'recovery'];

/**
 * Route Handler for exchanging Supabase Auth PKCE codes or verifying email OTP
 * token hashes (invitations & password recovery) for authenticated session cookies.
 *
 * Supports:
 * - Flow A: Token-hash invitation & recovery links (?token_hash=...&type=invite|recovery)
 * - Flow B: Existing PKCE code links (?code=...)
 */
export async function handleAuthCallback(request: NextRequest, customSupabase?: any) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/admin/reset-password';

  // Resolve trusted public origin to prevent internal IP or host header poisoning
  const trustedOrigin = getTrustedAuthOrigin();
  const isTrustedRequestOrigin =
    origin.includes('zimkickoff.co.zw') ||
    (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')));
  const redirectBase = isTrustedRequestOrigin ? origin : trustedOrigin;

  // Strict anti-open-redirect guard:
  // Destination must be an internal relative path starting with a single '/'
  const isSafeRelativePath = next.startsWith('/') && !next.startsWith('//') && !next.includes('\\');
  const safeNext = isSafeRelativePath ? next : '/admin/reset-password';

  // Collect any session cookies set by Supabase during verification/exchange
  const responseCookies: { name: string; value: string; options?: any }[] = [];

  let supabase = customSupabase;

  if (Array.isArray(customSupabase?._mockCookiesToSet)) {
    responseCookies.push(...customSupabase._mockCookiesToSet);
  }

  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Auth Callback Error]: Missing Supabase public configuration.');
      return NextResponse.redirect(`${redirectBase}/admin/login?error=invalid_recovery_link`);
    }

    let cookieStore: any = null;
    try {
      cookieStore = await cookies();
    } catch {
      // Safe fallback if called outside Next.js request context (e.g. testing)
    }

    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (cookieStore) {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // Ignore if response is already streaming
              }
            }
            responseCookies.push({ name, value, options });
          });
        },
      },
    });
  }

  const createRedirectResponse = (destination: string) => {
    const response = NextResponse.redirect(destination);
    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  // Flow A: Token-hash invitation and password recovery verification
  if (token_hash || type) {
    if (!token_hash || !type || !ALLOWED_OTP_TYPES.includes(type)) {
      console.warn('[Auth Callback Security]: Invalid or unsupported token_hash / type combination.');
      return NextResponse.redirect(`${redirectBase}/admin/login?error=invalid_recovery_link`);
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });

      if (!error) {
        return createRedirectResponse(`${redirectBase}${safeNext}`);
      }

      console.error('[Auth Callback Error]: verifyOtp failed:', error.message);
    } catch (err: any) {
      console.error('[Auth Callback Error]: Unexpected exception during verifyOtp:', err?.message || err);
    }

    return NextResponse.redirect(`${redirectBase}/admin/login?error=invalid_recovery_link`);
  }

  // Flow B: PKCE code exchange
  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return createRedirectResponse(`${redirectBase}${safeNext}`);
      }

      console.error('[Auth Callback Error]: exchangeCodeForSession failed:', error.message);
    } catch (err: any) {
      console.error('[Auth Callback Error]: Unexpected exception during code exchange:', err?.message || err);
    }

    return NextResponse.redirect(`${redirectBase}/admin/login?error=invalid_recovery_link`);
  }

  // If both code and token_hash are missing, redirect to login with an explicit sanitized error notice
  return NextResponse.redirect(`${redirectBase}/admin/login?error=invalid_recovery_link`);
}

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
