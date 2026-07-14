import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Live Football Broadcasts & Active Streams | ZimKickOff',
  description: 'View all ongoing live football streams. Never miss a goal with ZimKickOff live feeds.',
  alternates: {
    canonical: '/live',
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
        "url": "https://zimkickoff.co.zw/apple-touch-icon.png"
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
