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
  return <HomeClient />;
}
