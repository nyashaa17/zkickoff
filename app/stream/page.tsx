import { Metadata } from 'next';
import StreamGuideContent from '@/components/stream-guide-content';

export const metadata: Metadata = {
  title: 'How to Watch Premier League on TV in the UK',
  description: 'How to watch Premier League on TV in the UK, including Sky Sports, TNT Sports, BBC highlights, live streaming options and matchday viewing tips.',
  keywords: 'how to watch Premier League on TV UK, Premier League live TV, Sky Sports Premier League, TNT Sports Premier League, BBC Match of the Day, Premier League live stream UK',
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
  },
  openGraph: {
    title: 'How to Watch Premier League on TV in the UK',
    description: 'A simple guide to watching Premier League football on UK TV, including Sky Sports, TNT Sports, BBC highlights and online streaming options.',
    type: 'article',
    siteName: 'Total Sports Live',
  }
};

export default function StreamPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                "headline": "How to Watch Premier League on TV in the UK",
                "description": "A clear guide to watching Premier League football on UK TV, including Sky Sports, TNT Sports, BBC highlights, streaming options and embedded matchday viewing.",
                "author": {
                  "@type": "Organization",
                  "name": "Total Sports Live"
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "Total Sports Live"
                },
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": "https://totalsportslive.co.zw/"
                }
              },
              {
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "Are all Premier League matches shown live in the UK?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "No. Not every Premier League fixture is shown live on UK TV. Fans should check the latest confirmed TV schedule before kick-off."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "What channel shows Premier League football in the UK?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Premier League live TV coverage in the UK is mainly shown by Sky Sports and TNT Sports, while BBC Sport provides free-to-air highlights."
                    }
                  },
                  {
                    "@type": "Question",
                    "name": "Can I stream Premier League matches online?",
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes. Televised Premier League games can usually be streamed through the official online platforms connected to the broadcaster showing the match."
                    }
                  }
                ]
              }
            ]
          })
        }}
      />
      <StreamGuideContent />
    </>
  );
}
