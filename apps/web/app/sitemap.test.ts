import sitemap, { dynamic } from './sitemap';

describe('sitemap', () => {
  it('lists exactly the three public routes with absolute https URLs', () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      'https://mariajosetolmo.cl/',
      'https://mariajosetolmo.cl/experiencia/',
      'https://mariajosetolmo.cl/acceso/',
    ]);
  });

  it('leaves the private routes out', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes('/reclutador/'))).toBe(false);
    expect(urls.some((url) => url.includes('/verificar/'))).toBe(false);
  });

  it('is static so the export can emit it', () => {
    expect(dynamic).toBe('force-static');
  });
});
