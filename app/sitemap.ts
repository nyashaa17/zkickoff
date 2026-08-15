/**
 * Dynamic sitemap generator for ZimKickOff.
 *
 * Replaces the old static public/sitemap.xml with a Next.js Metadata API
 * sitemap that includes:
 *  1. All static pages (home, about, contact, etc.)
 *  2. All upcoming match preview pages for the next 14 days
 *  3. All upcoming match watch pages for the next 14 days
 *
 * This ensures Googlebot discovers match URLs days before kickoff,
 * not after the match is played.
 *
 * Regenerated on each request with ISR caching via getUpcomingFixtures().
 */
import { MetadataRoute } from 'next';
import { getUpcomingFixtures } from '@/lib/upcoming-fixtures';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zimkickoff.co.zw';

  // 1. Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/live`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/stream`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/worldcup`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/dmca`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // 2. Dynamic match pages — fetch all fixtures for the next 14 days
  let matchPages: MetadataRoute.Sitemap = [];

  try {
    const fixtures = await getUpcomingFixtures(14);

    matchPages = fixtures.flatMap((fixture) => {
      const lastMod = new Date();

      // Determine priority and change frequency based on match status
      let priority: number;
      let changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];

      if (fixture.status === 'LIVE') {
        priority = 1.0;
        changeFrequency = 'always';
      } else if (fixture.status === 'TODAY') {
        priority = 0.9;
        changeFrequency = 'hourly';
      } else if (fixture.status === 'UPCOMING') {
        priority = 0.8;
        changeFrequency = 'daily';
      } else {
        // FINISHED
        priority = 0.5;
        changeFrequency = 'weekly';
      }

      return [
        {
          url: `${baseUrl}/preview/${fixture.slug}`,
          lastModified: lastMod,
          changeFrequency,
          priority,
        },
        {
          url: `${baseUrl}/watch/${fixture.slug}`,
          lastModified: lastMod,
          changeFrequency,
          priority: Math.max(priority - 0.1, 0.3),
        },
      ];
    });
  } catch (err) {
    console.error('[sitemap] Error fetching upcoming fixtures:', err);
  }

  return [...staticPages, ...matchPages];
}
