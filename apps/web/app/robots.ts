import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/metadata';

export const dynamic = 'force-static';

// No `disallow`: a crawler that cannot fetch /reclutador/ or /acceso/verificar/
// would never see their `noindex`. Keeping them out of the index is the job of
// the page metadata, not of this file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
