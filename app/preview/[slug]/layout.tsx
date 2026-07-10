import { Metadata } from 'next';
import React from 'react';

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  // Format teams nicely for title
  const parts = slug.split('-');
  let title = 'Match Preview & Live Stream';
  let description = 'Read match stats, predictions, win probability, and watch free live football stream in HD. No signup required.';
  
  try {
    const teamsPart = parts.slice(0, parts.length - 1).join('-');
    const teams = teamsPart.split('-vs-');
    if (teams.length === 2) {
      const homeName = teams[0].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const awayName = teams[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      title = `Match Preview: ${homeName} vs ${awayName}`;
      description = `Read match stats, head-to-head forms, predictive polls, and watch ${homeName} vs ${awayName} live stream in HD. No signup required.`;
    }
  } catch (e) {
    // Keep fallback
  }
  
  return {
    title: `${title} | ZimKickOff`,
    description,
    alternates: {
      canonical: `/preview/${slug}`, 
    },
    openGraph: {
      title: `${title} | ZimKickOff`,
      description,
      url: `/preview/${slug}`,
    }
  };
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
