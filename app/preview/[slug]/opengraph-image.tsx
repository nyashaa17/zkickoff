import { ImageResponse } from 'next/og';
import { safeGetOgLogo } from '@/lib/bzzoiro-api';
import { parseSlug } from '@/lib/server-matches';
import { StadiumOgLayout } from '@/lib/og-layout';

export const alt = 'ZimKickOff Match Preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
export const revalidate = 86400; // Cache dynamic OG image for 24 hours

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || '';

  // Parse slug to extract human readable team names
  const { isParseable, homeName: parsedHome, awayName: parsedAway } = parseSlug(slug);
  const homeName = isParseable && parsedHome ? parsedHome : 'Home Team';
  const awayName = isParseable && parsedAway ? parsedAway : 'Away Team';

  // Pre-fetch and validate team logo images into memory with fallback protection
  const [homeLogo, awayLogo] = await Promise.all([
    safeGetOgLogo(homeName),
    safeGetOgLogo(awayName),
  ]);

  return new ImageResponse(
    (
      <StadiumOgLayout
        homeName={homeName}
        awayName={awayName}
        homeLogo={homeLogo}
        awayLogo={awayLogo}
        chipLabel="MATCH PREVIEW"
      />
    ),
    {
      ...size,
    }
  );
}
