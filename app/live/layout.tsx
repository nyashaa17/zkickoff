import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Live Football Broadcasts & Active Streams | ZimKickOff',
  description: 'View all ongoing live football streams and active fixtures. Follow real-time match coverage on ZimKickOff.',
  alternates: {
    canonical: 'https://zimkickoff.co.zw/live',
  },
  openGraph: {
    title: 'Live Football Broadcasts & Active Streams | ZimKickOff',
    description: 'View all ongoing live football streams and active fixtures on ZimKickOff.',
    url: 'https://zimkickoff.co.zw/live',
    siteName: 'ZimKickOff',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Football Broadcasts & Active Streams | ZimKickOff',
    description: 'View all ongoing live football streams and active fixtures on ZimKickOff.',
  },
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/live#webpage",
    "url": "https://zimkickoff.co.zw/live",
    "name": "Live Football Broadcasts & Active Streams | ZimKickOff",
    "description": "View all ongoing live football streams. Never miss a goal with ZimKickOff live feeds.",
    "publisher": {
      "@type": "Organization",
      "name": "ZimKickOff",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zimkickoff.co.zw/ZKickoff_icon-512x512.png"
      }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
