import { Metadata } from 'next';
import Link from 'next/link';
import HomeClient from './home-client';
import { getUpcomingFixturesForSeo, UpcomingFixture } from '@/lib/upcoming-fixtures';

export const metadata: Metadata = {
  title: 'ZimKickOff - Watch Live Football Matches Free',
  description: 'Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly',
  alternates: {
    canonical: '/',
  },
};

/**
 * Server-rendered list of upcoming fixture links.
 * This section is invisible to users (hidden via CSS) but provides
 * Googlebot with crawlable <a href="/preview/..."> links in the
 * initial HTML response, ensuring match pages are discoverable
 * well before kickoff.
 */
function UpcomingFixturesNav({ fixtures }: { fixtures: UpcomingFixture[] }) {
  if (!fixtures.length) return null;

  return (
    <nav
      aria-label="Upcoming football fixtures"
      className="sr-only"
    >
      <h2>Upcoming Matches</h2>
      <ul>
        {fixtures.map((f) => (
          <li key={f.slug}>
            <Link href={`/preview/${f.slug}`}>
              {f.homeName} vs {f.awayName} — {f.competition} — {f.kickoffTime}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function HomePage() {
  // Fetch upcoming fixtures server-side for SEO internal linking
  let upcomingFixtures: UpcomingFixture[] = [];
  try {
    upcomingFixtures = await getUpcomingFixturesForSeo(14);
  } catch (err) {
    console.error('[HomePage] Error fetching upcoming fixtures:', err);
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://zimkickoff.co.zw/#website",
    "url": "https://zimkickoff.co.zw/",
    "name": "ZimKickOff",
    "description": "Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly",
    "publisher": {
      "@type": "Organization",
      "name": "ZimKickOff",
      "logo": {
        "@type": "ImageObject",
        "url": "https://zimkickoff.co.zw/apple-touch-icon.png"
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://zimkickoff.co.zw/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const webpageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/#webpage",
    "url": "https://zimkickoff.co.zw/",
    "name": "ZimKickOff - Watch Live Football Matches Free",
    "description": "Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly",
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
      <HomeClient />
      {/* Server-rendered crawlable links for SEO — hidden from users */}
      <UpcomingFixturesNav fixtures={upcomingFixtures} />
    </>
  );
}

