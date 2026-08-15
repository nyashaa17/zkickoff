/**
 * Dynamic robots.txt generator for ZimKickOff.
 *
 * Replaces the static public/robots.txt so the sitemap URL
 * always points to the dynamically generated sitemap.
 */
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://zimkickoff.co.zw/sitemap.xml',
  };
}
