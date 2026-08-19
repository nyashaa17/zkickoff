import { Metadata } from 'next';
import { getRecentHighlights } from '@/lib/highlights-service';
import HighlightsClient from './highlights-client';

export const metadata: Metadata = {
  title: 'Video Highlights | ZimKickOff',
  description: 'Watch the latest football video highlights from top leagues around the world. Goals, saves, and key moments from the Premier League, La Liga, Serie A, Champions League, and more.',
  openGraph: {
    title: 'Video Highlights | ZimKickOff',
    description: 'Watch the latest football video highlights from top leagues worldwide.',
    type: 'website',
    url: 'https://zimkickoff.co.zw/highlights',
  },
};

export default async function HighlightsPage() {
  const { highlights, hasMore } = await getRecentHighlights(20, 0);

  return <HighlightsClient initialHighlights={highlights} initialHasMore={hasMore} />;
}
