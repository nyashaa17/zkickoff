import { Metadata } from 'next';
import { SITE_CONFIG } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact Us & Active Support | ZimKickOff',
  description: `Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official email at ${SITE_CONFIG.supportEmail}.`,
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us & Active Support | ZimKickOff',
    description: `Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official email at ${SITE_CONFIG.supportEmail}.`,
    url: '/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${SITE_CONFIG.baseUrl}/contact#webpage`,
    "url": `${SITE_CONFIG.baseUrl}/contact`,
    "name": "Contact Us & Active Support | ZimKickOff",
    "description": `Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official email at ${SITE_CONFIG.supportEmail}.`,
    "publisher": {
      "@type": "Organization",
      "name": SITE_CONFIG.name,
      "email": SITE_CONFIG.supportEmail,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_CONFIG.baseUrl}/apple-touch-icon.png`
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
