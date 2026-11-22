import { Metadata } from 'next';
import HomeClient from './home-client';
import { fetchMatchesForDate } from '@/lib/server-matches';
import { getFormattedDateString } from '@/lib/totalsports-api';
import { Match } from '@/lib/matches-data';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'ZimKickOff — Live Football Scores, Today\'s Fixtures & Streams',
  description:
    'Follow live football scores, today\'s match schedules, league standings, and match previews across Premier League, Champions League, La Liga, and global competitions on ZimKickOff.',
  alternates: {
    canonical: 'https://zimkickoff.co.zw/',
  },
  openGraph: {
    title: 'ZimKickOff — Live Football Scores, Today\'s Fixtures & Streams',
    description:
      'Follow live football scores, today\'s match schedules, league standings, and match previews across top global competitions on ZimKickOff.',
    url: 'https://zimkickoff.co.zw/',
    siteName: 'ZimKickOff',
    locale: 'en_ZW',
    type: 'website',
    images: [
      {
        url: '/opengraph.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'ZimKickOff — Live Football Scores, Today\'s Fixtures & Streams',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZimKickOff — Live Football Scores, Today\'s Fixtures & Streams',
    description:
      'Follow live football scores, today\'s match schedules, and league standings on ZimKickOff.',
    images: ['/opengraph.png'],
  },
};

const SSR_MATCH_LIMIT = 30;
const MAJOR_LEAGUE_HINTS = [
  'premier league',
  'la liga',
  'laliga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'champions league',
  'europa league',
  'zimbabwe',
  'zpsl',
];

function selectInitialSsrMatches(matches: Match[]): Match[] {
  if (matches.length <= SSR_MATCH_LIMIT) return matches;

  const scoreMatch = (m: Match): number => {
    let score = 0;
    if (m.status === 'LIVE') score += 100;
    else if (m.status === 'TODAY') score += 50;
    else if (m.status === 'FINISHED') score += 20;

    const compLower = (m.competition || '').toLowerCase();
    if (MAJOR_LEAGUE_HINTS.some((hint) => compLower.includes(hint))) {
      score += 40;
    }
    return score;
  };

  return [...matches]
    .sort((a, b) => scoreMatch(b) - scoreMatch(a))
    .slice(0, SSR_MATCH_LIMIT);
}

export default async function HomePage() {
  // Fetch today's matches server-side for lightweight, visible SSR rendering
  let initialMatches: Match[] = [];
  try {
    const todayStr = getFormattedDateString(0);
    const todayMatches = await fetchMatchesForDate(todayStr, 'Today', 60);
    initialMatches = selectInitialSsrMatches(todayMatches);
  } catch (err) {
    console.error('[HomePage] Error fetching initial matches:', err);
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://zimkickoff.co.zw/#website",
    "url": "https://zimkickoff.co.zw/",
    "name": "ZimKickOff",
    "description": "Follow live football scores, today's match schedules, league standings, and match previews across top global competitions on ZimKickOff.",
    "publisher": {
      "@type": "Organization",
      "name": "ZimKickOff",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zimkickoff.co.zw/ZKickoff_icon-512x512.png"
      }
    }
  };

  const webpageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/#webpage",
    "url": "https://zimkickoff.co.zw/",
    "name": "ZimKickOff — Live Football Scores, Today's Fixtures & Streams",
    "description": "Follow live football scores, today's match schedules, league standings, and match previews across Premier League, Champions League, La Liga, and global competitions on ZimKickOff.",
    "isPartOf": {
      "@id": "https://zimkickoff.co.zw/#website"
    },
    "about": {
      "@type": "Organization",
      "name": "ZimKickOff"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageSchema) }}
      />
      <HomeClient initialMatches={initialMatches} />
    </>
  );
}

