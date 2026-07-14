import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About ZimKickOff - Premium Football News & Match Live Streams',
  description: 'ZimKickOff is the leading digital platform for Zimbabwean football enthusiasts. We provide real-time Castle Lager PSL updates, fixtures, and aggregate public streams.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About ZimKickOff - Premium Football News & Match Live Streams',
    description: 'ZimKickOff is the leading digital platform for Zimbabwean football enthusiasts. We provide real-time Castle Lager PSL updates, fixtures, and aggregate public streams.',
    url: '/about',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": "https://zimkickoff.co.zw/about#webpage",
    "url": "https://zimkickoff.co.zw/about",
    "name": "About ZimKickOff - Premium Football News & Match Live Streams",
    "description": "ZimKickOff is the leading digital platform for Zimbabwean football enthusiasts. We provide real-time Castle Lager PSL updates, fixtures, and aggregate public streams.",
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
