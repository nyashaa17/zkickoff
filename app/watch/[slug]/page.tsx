import { getMatchForPreview } from '@/lib/server-matches';
import WatchClient from './watch-client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ server?: string }>;
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { server } = await searchParams;
  const { match, allMatches } = await getMatchForPreview(slug);

  return (
    <WatchClient
      slug={slug}
      initialServer={server}
      initialMatch={match}
      initialAllMatches={allMatches}
    />
  );
}
