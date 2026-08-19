import { getMatchForPreview } from '@/lib/server-matches';
import { notFound } from 'next/navigation';
import WatchClient from './watch-client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ server?: string }>;
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { server } = await searchParams;
  const { match, allMatches, isParseable } = await getMatchForPreview(slug);

  // Unparseable / malformed slugs trigger a real 404
  if (!isParseable || !match) {
    notFound();
  }

  return (
    <WatchClient
      slug={slug}
      initialServer={server}
      initialMatch={match}
      initialAllMatches={allMatches}
    />
  );
}
