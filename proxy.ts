import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Next.js Request Proxy Handler (Next.js 16+ convention).
 *
 * 1. Strips tracking parameters on /watch/* to preserve canonical cache.
 * 2. Redirects root /admin to /admin/events.
 * 3. Refreshes expired Supabase session tokens via refresh tokens and propagates
 *    updated cookies to both request and response.
 *
 * Security Invariants:
 * - Zero privileged operations: never executes service_role or admin allowlist checks here.
 * - Route guards remain enforced in Server Component layouts and Server Actions.
 * - Does not redirect unauthenticated users away globally to avoid redirect loops on
 *    auth callbacks, recovery routes, public match pages, and login.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // 1. Define tracking parameters to strip on /watch/* pages
  const trackingParams = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'id'];
  let shouldRedirect = false;

  if (url.pathname.startsWith('/watch/')) {
    trackingParams.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        shouldRedirect = true;
      }
    });

    if (shouldRedirect) {
      // 301 Permanent Redirect to canonical version without tracking parameters
      return NextResponse.redirect(url, 301);
    }
  }

  // 2. Root /admin convenience redirect to /admin/events
  if (url.pathname === '/admin') {
    const redirectUrl = url.clone();
    redirectUrl.pathname = '/admin/events';
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Supabase session refreshing
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Calling getUser() validates and refreshes expired tokens, updating cookies via setAll
    await supabase.auth.getUser();
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
