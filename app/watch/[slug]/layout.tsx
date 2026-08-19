import { Metadata } from 'next';
import React from 'react';
import { parseSlug } from '@/lib/server-matches';

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { isParseable, homeName, awayName } = parseSlug(slug);

  let title = 'Watch Live Football Stream';
  let description = 'Watch live football stream in HD. No signup required.';

  if (isParseable && homeName && awayName) {
    title = `Watch ${homeName} vs ${awayName} Live Stream`;
    description = `Watch ${homeName} vs ${awayName} live stream in HD. No signup required.`;
  }
  
  const ogImageUrl = `https://zimkickoff.co.zw/watch/${slug}/opengraph-image`;
  const canonicalUrl = `https://zimkickoff.co.zw/watch/${slug}`;

  return {
    title: `${title} | ZimKickOff`,
    description,
    alternates: {
      canonical: canonicalUrl, 
    },
    openGraph: {
      title: `${title} | ZimKickOff`,
      description,
      url: canonicalUrl,
      siteName: 'ZimKickOff',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          secureUrl: ogImageUrl,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: `${title} | ZimKickOff`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ZimKickOff`,
      description,
      images: [ogImageUrl],
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
  const { isParseable, homeName: parsedHome, awayName: parsedAway } = parseSlug(slug);
  const homeName = isParseable && parsedHome ? parsedHome : 'Home Team';
  const awayName = isParseable && parsedAway ? parsedAway : 'Away Team';

  const sportsEventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "@id": `https://zimkickoff.co.zw/watch/${slug}#event`,
    "name": `${homeName} vs ${awayName} Live Stream`,
    "description": `Watch ${homeName} vs ${awayName} live football match stream in HD. No signup required.`,
    "sport": "https://en.wikipedia.org/wiki/Association_football",
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
    "homeTeam": {
      "@type": "SportsTeam",
      "name": homeName
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": awayName
    },
    "competitor": [
      { "@type": "SportsTeam", "name": homeName },
      { "@type": "SportsTeam", "name": awayName }
    ],
    "location": {
      "@type": "VirtualLocation",
      "url": `https://zimkickoff.co.zw/watch/${slug}`
    },
    "url": `https://zimkickoff.co.zw/watch/${slug}`,
    "organizer": {
      "@type": "Organization",
      "name": "ZimKickOff",
      "url": "https://zimkickoff.co.zw"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": `https://zimkickoff.co.zw/watch/${slug}`
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
