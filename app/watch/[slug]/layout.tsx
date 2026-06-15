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
    }
  };
}

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
