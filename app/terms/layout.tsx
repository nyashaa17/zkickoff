import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service & Disclaimer | ZimKickOff',
  description: 'Read the official terms and conditions for using the ZimKickOff aggregate platform. Review legal disclaimers, user rules, and compliance requirements.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service & Disclaimer | ZimKickOff',
    description: 'Read the official terms and conditions for using the ZimKickOff aggregate platform. Review legal disclaimers, user rules, and compliance requirements.',
    url: '/terms',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/terms#webpage",
    "url": "https://zimkickoff.co.zw/terms",
    "name": "Terms of Service & Disclaimer | ZimKickOff",
    "description": "Read the official terms and conditions for using the ZimKickOff aggregate platform. Review legal disclaimers, user rules, and compliance requirements.",
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
