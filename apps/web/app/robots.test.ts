import robots, { dynamic } from './robots';

describe('robots', () => {
  it('allows everything and points at the absolute sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://mariajosetolmo.cl/sitemap.xml',
    });
  });

  it('never disallows a path: a blocked crawler cannot read the noindex', () => {
    expect(JSON.stringify(robots())).not.toMatch(/disallow/i);
  });

  it('is static so the export can emit it', () => {
    expect(dynamic).toBe('force-static');
  });
});
