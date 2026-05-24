import type {Metadata} from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css'; // Global styles
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';

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
  title: 'ZimKickOff - Watch Free Live Football Matches',
  description: 'Listen and stream free live football matches in Zimbabwe. Fast, reliable, mobile-optimized, and no signup needed. Follow the Zimbabwe Premier Soccer League and global tournaments.',
  keywords: 'ZimKickOff, Live Football Zimbabwe, ZPSL Streaming, Dynamos FC stream, Highlanders FC stream, CAPS United stream, free soccer stream, football live streams, Zimbabwe soccer',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <script src="https://pl29495869.effectivecpmnetwork.com/9b/80/d6/9b80d664eeb4b02b5df5aa047fb0f37a.js" defer></script>
      </head>
      <body className="font-sans bg-[#F9F9FB] text-neutral-900 selection:bg-[#009739] selection:text-white antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        <Navbar />
        <main className="flex-1 pb-12">
          {children}
        </main>
        <Footer />
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
