/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');
const { documentedRoutes } = require('./check-out');

const webRoot = path.join(__dirname, '..');
const read = (...parts) =>
  fs.readFileSync(path.join(webRoot, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(webRoot, ...parts));

const doc = exists('docs', 'delivery-contract.md')
  ? read('docs', 'delivery-contract.md')
  : '';

/** Text of a `## ` section, up to the next one. */
function section(title) {
  const lines = doc.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${title}`));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Routes that `app/**` produces: every folder holding a page.tsx. */
function appRoutes(dir = path.join(webRoot, 'app'), prefix = '/') {
  const own = fs.existsSync(path.join(dir, 'page.tsx')) ? [prefix] : [];
  const nested = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => appRoutes(path.join(dir, e.name), `${prefix}${e.name}/`));
  return [...own, ...nested].sort();
}

describe('delivery contract document', () => {
  it('exists in apps/web/docs and is linked from the README', () => {
    expect(exists('docs', 'delivery-contract.md')).toBe(true);
    expect(read('README.md')).toContain('docs/delivery-contract.md');
  });

  it.each([
    'index.html',
    '/404.html',
    's3:ListBucket',
    'immutable',
    'Content-Security-Policy',
    'Strict-Transport-Security',
    "frame-ancestors 'none'",
    "'unsafe-inline'",
    'cloudfront-js-2.0',
    'CachingDisabled',
    '/api/*',
    'OAC',
  ])('mentions %s', (text) => {
    expect(doc).toContain(text);
  });

  it('documents out/_not-found/ as a Next internal, not a site route', () => {
    expect(section('Artefacto')).toMatch(/`_not-found\/`.*(interna|interno)/s);
    expect(documentedRoutes(doc)).not.toContain('/_not-found/');
  });

  it('lists the header values (not the names) in the value column', () => {
    expect(doc).toMatch(/Referrer-Policy`?\s*\|\s*`?no-referrer`?\s*\|/);
    expect(doc).toMatch(/X-Content-Type-Options`?\s*\|\s*`?nosniff`?\s*\|/);
  });

  it('records the CSP browser verification and the hashes follow-up', () => {
    const headers = section('Cabeceras');
    expect(headers).toContain('Chrome');
    expect(headers).toContain('2026-10-21');
    expect(headers).toContain('Report-Only');
    expect(headers).toContain('Mejora futura');
    expect(headers).toMatch(/hashes/);
  });

  it('has the sections infra needs, in Spanish', () => {
    for (const title of [
      'Rutas generadas',
      'Reescritura de rutas',
      'Página de error',
      'Caché',
      'Cabeceras',
      'Origen',
    ]) {
      expect(section(title)).not.toBe('');
    }
  });

  describe('error page', () => {
    const errors = section('Página de error');

    it('maps only the 404 to /404.html, with a 404 status', () => {
      expect(errors).toMatch(/404[^\n]*\/404\.html/);
      expect(errors).toMatch(/código(?: HTTP)? 404/);
    });

    it('says explicitly that 403 is not mapped, and never maps it', () => {
      expect(errors).toMatch(/403[^\n]*nunca se mapea/);
      const mapping = errors
        .split('\n')
        .filter((line) => line.includes('403') && line.includes('/404.html'));
      expect(mapping).toEqual([]);
    });

    it('warns that /api/* 404s would be replaced too and names the options', () => {
      expect(errors).toContain('/api/*');
      expect(errors).toContain('Lambda@Edge');
    });
  });

  describe('CloudFront Function', () => {
    const code = (section('Reescritura de rutas').match(
      /```js\n([\s\S]*?)```/,
    ) ?? [])[1];
    const handler = code ? new Function(`${code}; return handler;`)() : null;
    const rewrite = async (uri) => (await handler({ request: { uri } })).uri;

    it('is documented as runnable code', () => {
      expect(typeof handler).toBe('function');
    });

    it.each([
      ['/', '/index.html'],
      ['/experiencia/', '/experiencia/index.html'],
      ['/acceso/verificar/', '/acceso/verificar/index.html'],
      ['/experiencia', '/experiencia/index.html'],
      ['/_next/static/chunks/abc.js', '/_next/static/chunks/abc.js'],
      ['/robots.txt', '/robots.txt'],
      ['/404.html', '/404.html'],
    ])('rewrites %s to %s', async (from, to) => {
      expect(await rewrite(from)).toBe(to);
    });
  });

  it('documents exactly the routes the app folder generates', () => {
    expect(documentedRoutes(doc)).toEqual(appRoutes());
  });

  it('carries no account IDs, keys or secrets', () => {
    expect(doc).not.toMatch(/\b\d{12}\b/);
    expect(doc).not.toMatch(/\b(AKIA|ASIA)[0-9A-Z]{16}\b/);
    expect(doc).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(doc).not.toMatch(/arn:aws:[a-z0-9-]*:[a-z0-9-]*:\d+/);
  });
});

describe('README', () => {
  const readme = read('README.md');

  it.each([
    'npm run dev -w apps/web',
    'npm run preview -w apps/web',
    'npm run build -w apps/web',
    'npm run check:out -w apps/web',
    'NEXT_PUBLIC_API_MODE',
    'mock',
    'http',
    'prune-out.js',
  ])('covers %s', (text) => {
    expect(readme).toContain(text);
  });
});
