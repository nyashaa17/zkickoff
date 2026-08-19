import { getMatchForPreview } from '@/lib/server-matches';
import { notFound } from 'next/navigation';
import MatchPreviewClient from './preview-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MatchPreviewPage({ params }: PageProps) {
  const { slug } = await params;
  const { match, allMatches } = await getMatchForPreview(slug);

  if (!match) {
    notFound();
  }

  return (
    <MatchPreviewClient
      slug={slug}
      initialMatch={match}
      initialAllMatches={allMatches}
    />
  );
}
