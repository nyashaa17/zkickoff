import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  
  // Define tracking parameters we want to strip
  const trackingParams = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'id'];
  
  let shouldRedirect = false;

  // Only apply aggressive duplicate stripping to /watch/* pages to avoid breaking main site filters
  if (url.pathname.startsWith('/watch/')) {
    trackingParams.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        shouldRedirect = true;
      }
    });

    if (shouldRedirect) {
      // 301 Permanent Redirect to the canonical version without tracking parameters
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/watch/:path*',
  ],
};
