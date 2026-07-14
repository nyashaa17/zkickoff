import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us & Active Support | ZimKickOff',
  description: 'Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official Telegram Support desk.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us & Active Support | ZimKickOff',
    description: 'Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official Telegram Support desk.',
    url: '/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": "https://zimkickoff.co.zw/contact#webpage",
    "url": "https://zimkickoff.co.zw/contact",
    "name": "Contact Us & Active Support | ZimKickOff",
    "description": "Have feedback, dynamic alignment suggestions, or copyright issues? Contact ZimKickOff administrators via our official Telegram Support desk.",
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
