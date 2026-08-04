import type {Metadata} from 'next';
import { Inter, Poppins } from 'next/font/google';
import Script from 'next/script';
import './globals.css'; // Global styles
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { WhatsAppPopup } from '@/components/whatsapp-popup';
import { GlobalAdBanner } from '@/components/global-ad-banner';
import AdblockNotice from '@/components/adblock-notice';
import WorldCupTicker from '@/components/worldcup-ticker';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'ZimKickOff - Watch Live Football Matches Free',
  description: 'Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly',
  keywords: 'ZimKickOff, Live Football Zimbabwe, free soccer stream, football live streams, Zimbabwe soccer, Koora live, كورة لايف, Yalla shoot, يلاشوت, Live stream, Football stream',
  metadataBase: new URL('https://zimkickoff.co.zw'),
  openGraph: {
    title: 'ZimKickOff - Watch Live Football Matches Free',
    description: 'Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly',
    url: 'https://zimkickoff.co.zw',
    type: 'website',
    images: [
      {
        url: '/OpenGraph.png',
        width: 1200,
        height: 630,
        alt: 'ZimKickOff Open Graph Image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZimKickOff - Watch Live Football Matches Free',
    description: 'Watch Free Live Football Streams In HD No Signup Required Stream Premier League UEFA Champions League La Liga And Top Matches Worldwide Instantly',
    images: ['/OpenGraph.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onerror = function (message, url, line, col, error) {
                if (message === 'Script error.' || !url) {
                  return true;
                }
                if (
                  url.includes('googletagmanager') ||
                  message.toString().includes('Script error')
                ) {
                  return true;
                }
                return false;
              };
              window.addEventListener('unhandledrejection', function (event) {
                if (event.reason) {
                  const msg = event.reason.message || '';
                  if (
                    msg === 'Script error.' ||
                    msg.includes('Script error')
                  ) {
                    event.preventDefault();
                  }
                }
              });
            `
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "ZimKickOff",
              "url": "https://zimkickoff.co.zw/",
              "description": "Watch live football matches for free on ZimKickOff. Stream HD football games worldwide, including Premier League, Champions League, and more",
              "applicationCategory": "SportsApplication",
              "operatingSystem": "Web",
              "publisher": {
                "@type": "Organization",
                "name": "ZimKickOff",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://zimkickoff.co.zw/apple-touch-icon.png"
                }
              },
              "brand": {
                "@type": "Brand",
                "name": "ZimKickOff"
              },
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              }
            })
          }}
        />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-1T22JFEXXS" />
        <Script id="clickadilla-popunder" async src="https://js.wpadmngr.com/static/adManager.js" data-admpid="450615" strategy="afterInteractive" />
        <Script id="clickadilla-inpage" async src="https://js.wpadmngr.com/static/adManager.js" data-admpid="450656" strategy="afterInteractive" />
        <Script id="clickadilla-banner" async src="https://js.wpadmngr.com/static/adManager.js" data-admpid="450616" strategy="afterInteractive" />
        <Script id="google-analytics">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1T22JFEXXS');
          `}
        </Script>
      </head>
      <body className="font-sans bg-[#F9F9FB] text-neutral-900 selection:bg-[#009739] selection:text-white antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <AdblockNotice />
        <div className="sticky top-0 z-50 w-full flex flex-col [transform:translate3d(0,0,0)] [will-change:transform]">
          <WorldCupTicker />
          <Navbar />
        </div>
        <main className="flex-1 pb-12">
          {children}
        </main>
        <Footer />
        <WhatsAppPopup />
        <GlobalAdBanner />
        {/* Visual Zimbabwe Flag Strip accent */}
        <div className="h-1 w-full bg-linear-to-r from-[#009739] via-[#FFD100] to-[#D62828] flex">
          <div className="w-[30%] h-full bg-[#009739]"></div>
          <div className="w-[10%] h-full bg-[#FFD100]"></div>
          <div className="w-[10%] h-full bg-black"></div>
          <div className="w-[10%] h-full bg-[#FFD100]"></div>
          <div className="w-[40%] h-full bg-[#D62828]"></div>
        </div>
      </body>
    </html>
  );
}
