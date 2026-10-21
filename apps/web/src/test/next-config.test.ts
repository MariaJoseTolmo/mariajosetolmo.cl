import config from '../../next.config';

// The site is a static export: S3 serves files, so anything that needs a Next
// server (rewrites, redirects, headers) would silently do nothing in production.
describe('next.config (static export contract)', () => {
  it('exports static files with trailing slashes and unoptimized images', () => {
    expect(config.output).toBe('export');
    expect(config.trailingSlash).toBe(true);
    expect(config.images?.unoptimized).toBe(true);
  });

  it.each(['rewrites', 'redirects', 'headers'] as const)(
    'does not declare %s',
    (key) => {
      expect(config).not.toHaveProperty(key);
    },
  );
});
