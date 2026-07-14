import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMCA Takedown & Copyright Policy | ZimKickOff',
  description: 'ZimKickOff operates strictly as an aggregation platform and does not host copyrighted stream feeds. Review our Digital Millennium Copyright Act (DMCA) compliance rules.',
  alternates: {
    canonical: '/dmca',
  },
  openGraph: {
    title: 'DMCA Takedown & Copyright Policy | ZimKickOff',
    description: 'ZimKickOff operates strictly as an aggregation platform and does not host copyrighted stream feeds. Review our Digital Millennium Copyright Act (DMCA) compliance rules.',
    url: '/dmca',
  },
};

export default function DmcaLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": "https://zimkickoff.co.zw/dmca#webpage",
    "url": "https://zimkickoff.co.zw/dmca",
    "name": "DMCA Takedown & Copyright Policy | ZimKickOff",
    "description": "ZimKickOff operates strictly as an aggregation platform and does not host copyrighted stream feeds. Review our Digital Millennium Copyright Act (DMCA) compliance rules.",
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
