import { Metadata } from 'next';
import HomeClient from './home-client';

export const metadata: Metadata = {
  title: 'ZimKickOff - Watch Live Football Matches Free',
  description: 'Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly',
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
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
    </>
  );
}

