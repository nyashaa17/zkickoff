import { Metadata } from 'next';
import React from 'react';

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  // Format teams nicely for title
  const parts = slug.split('-');
  let title = 'Watch Live Football Stream';
  let description = 'Watch live football stream in HD. No signup required.';
  
  try {
    const teamsPart = parts.slice(0, parts.length - 1).join('-');
    const teams = teamsPart.split('-vs-');
    if (teams.length === 2) {
      const homeName = teams[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const awayName = teams[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      title = `Watch ${homeName} vs ${awayName} Live Stream`;
      description = `Watch ${homeName} vs ${awayName} live stream in HD. No signup required.`;
    }
  } catch (e) {
    // Keep fallback
  }
  
  return {
    title: `${title} | ZimKickOff`,
    description,
    alternates: {
      canonical: `/watch/${slug}`, 
    },
    openGraph: {
      title: `${title} | ZimKickOff`,
      description,
      url: `/watch/${slug}`,
      images: [
        {
          url: `/watch/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${title} | ZimKickOff`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ZimKickOff`,
      description,
      images: [`/watch/${slug}/opengraph-image`],
    },
  };
}

export default async function WatchLayout({ 
  children,
  params
}: { 
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Format teams nicely for title
  const parts = slug.split('-');
  let homeName = 'Home Team';
  let awayName = 'Away Team';
  
  try {
    const teamsPart = parts.slice(0, parts.length - 1).join('-');
    const teams = teamsPart.split('-vs-');
    if (teams.length === 2) {
      homeName = teams[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      awayName = teams[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  } catch (e) {
    // Keep fallback
  }

  const sportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `https://zimkickoff.co.zw/watch/${slug}#event`,
    "name": `${homeName} vs ${awayName} Live Stream`,
    "description": `Watch ${homeName} vs ${awayName} live football match stream in HD. No signup required.`,
    "sport": "https://en.wikipedia.org/wiki/Association_football",
    "homeTeam": {
      "@type": "SportsTeam",
      "name": homeName
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": awayName
    },
    "location": {
      "@type": "Place",
      "name": "Virtual / Online Stream",
      "url": `https://zimkickoff.co.zw/watch/${slug}`
    },
    "url": `https://zimkickoff.co.zw/watch/${slug}`,
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    }
  };

  const webpageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `https://zimkickoff.co.zw/watch/${slug}#webpage`,
    "url": `https://zimkickoff.co.zw/watch/${slug}`,
    "name": `Watch ${homeName} vs ${awayName} Live Stream | ZimKickOff`,
    "description": `Watch ${homeName} vs ${awayName} live stream in HD. No signup required.`,
    "isPartOf": {
      "@id": "https://zimkickoff.co.zw/#website"
    },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageSchema) }}
      />
      {children}
    </>
  );
}
