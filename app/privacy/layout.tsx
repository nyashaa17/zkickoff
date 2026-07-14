import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy & Cookie Policy | ZimKickOff',
  description: 'ZimKickOff is completely signup-free and collects zero personally identifiable information. Understand how we utilize log metrics and local cookies.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy & Cookie Policy | ZimKickOff',
    description: 'ZimKickOff is completely signup-free and collects zero personally identifiable information. Understand how we utilize log metrics and local cookies.',
    url: '/privacy',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/privacy#webpage",
    "url": "https://zimkickoff.co.zw/privacy",
    "name": "Privacy Policy & Cookie Policy | ZimKickOff",
    "description": "ZimKickOff is completely signup-free and collects zero personally identifiable information. Understand how we utilize log metrics and local cookies.",
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
