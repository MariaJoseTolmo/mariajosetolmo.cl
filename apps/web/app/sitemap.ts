import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_URL } from '@/content/metadata';

// Required for `output: 'export'`: the file is written once, at build time.
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({ url: `${SITE_URL}${route}` }));
}
