/** @jest-environment node */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  documentedRoutes,
  findViolations,
  generatedRoutes,
} = require('./check-out');

const NOINDEX = '<meta name="robots" content="noindex, nofollow"/>';
const HOME = 'https://mariajosetolmo.cl';
const DOC = [
  '# Contrato',
  '## Rutas generadas',
  '- `/`',
  '- `/experiencia/`',
  '- `/acceso/`',
  '- `/acceso/verificar/`',
  '- `/reclutador/`',
  '## Otra sección',
  'Esto menciona `/api/v1/me` pero no es una ruta del sitio.',
].join('\n');

let root;
let out;
let doc;

function write(rel, content = '') {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A minimal `out/` that satisfies every rule. */
function buildValidOut() {
  write('index.html', '<html lang="es"></html>');
  write('experiencia/index.html', '<html></html>');
  write('acceso/index.html', '<html></html>');
  write('acceso/verificar/index.html', `<html>${NOINDEX}</html>`);
  write('reclutador/index.html', `<html>${NOINDEX}</html>`);
  write('404.html', '<html></html>');
  write('_not-found/index.html', '<html></html>');
  write('_next/static/chunks/0cz1d0mv5g_q7.js', 'console.log(1)');
  write('_next/static/chunks/22a1l9nuboy4s.css', 'a{}');
  write('_next/static/BUILDID/_buildManifest.js', '');
  write('_next/static/media/0a1b2c3d4e5f6.woff2', 'font');
  write(
    'robots.txt',
    `User-Agent: *\nAllow: /\n\nSitemap: ${HOME}/sitemap.xml\n`,
  );
  write(
    'sitemap.xml',
    ['/', '/experiencia/', '/acceso/']
      .map((route) => `<url><loc>${HOME}${route}</loc></url>`)
      .join(''),
  );
  fs.writeFileSync(doc, DOC);
}

const run = () => findViolations(out, { docPath: doc });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-out-'));
  out = path.join(root, 'out');
  doc = path.join(root, 'delivery-contract.md');
  buildValidOut();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('findViolations', () => {
  it('accepts a complete, clean export', () => {
    expect(run()).toEqual([]);
  });

  it('reports a missing directory as one violation', () => {
    expect(findViolations(path.join(root, 'nope'), { docPath: doc })).toEqual([
      expect.stringContaining('out directory not found'),
    ]);
  });

  it.each([
    'index.html',
    'experiencia/index.html',
    'acceso/index.html',
    'acceso/verificar/index.html',
    'reclutador/index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
  ])('names the missing file %s', (file) => {
    fs.rmSync(path.join(out, file));
    expect(run().some((v) => v.includes(`missing ${file}`))).toBe(true);
  });

  it('requires the _next/static directory', () => {
    fs.rmSync(path.join(out, '_next'), { recursive: true });
    expect(run().some((v) => v.includes('missing _next/static/'))).toBe(true);
  });

  it.each(['fonts.googleapis.com', 'fonts.gstatic.com'])(
    'rejects a reference to %s (html, css or js)',
    (host) => {
      write('experiencia/index.html', `<link href="https://${host}/css">`);
      write('_next/static/chunks/22a1l9nuboy4s.css', `@import "//${host}/x";`);
      const found = run().filter((v) => v.includes(host));
      expect(found.sort()).toEqual([
        `forbidden "${host}" in _next/static/chunks/22a1l9nuboy4s.css`,
        `forbidden "${host}" in experiencia/index.html`,
      ]);
    },
  );

  it.each([
    '__WEB_CV_MOCK__',
    'Simular: abrir el enlace',
    'Reiniciar demo',
    'mock-token',
  ])('rejects the mock leak %j in a chunk and in an RSC payload', (marker) => {
    write('_next/static/chunks/0cz1d0mv5g_q7.js', `x("${marker}")`);
    write('acceso/index.txt', marker);
    const found = run().filter((v) => v.includes(marker));
    expect(found).toHaveLength(2);
    expect(found.join('\n')).toContain('0cz1d0mv5g_q7.js');
    expect(found.join('\n')).toContain('acceso/index.txt');
  });

  it.each(['cv.pdf', 'docs/carta.docx', 'CV.PDF'])(
    'rejects the document %s',
    (file) => {
      write(file, 'x');
      expect(run().some((v) => v.includes(file))).toBe(true);
    },
  );

  it('requires noindex on the two private pages', () => {
    write('reclutador/index.html', '<html></html>');
    write('acceso/verificar/index.html', '<html></html>');
    const found = run();
    expect(
      found.some(
        (v) => v.includes('reclutador/index.html') && v.includes('noindex'),
      ),
    ).toBe(true);
    expect(
      found.some(
        (v) =>
          v.includes('acceso/verificar/index.html') && v.includes('noindex'),
      ),
    ).toBe(true);
  });

  it('does not let a public page carry noindex', () => {
    write('experiencia/index.html', `<html>${NOINDEX}</html>`);
    expect(
      run().some(
        (v) => v.includes('experiencia/index.html') && v.includes('noindex'),
      ),
    ).toBe(true);
  });

  it('requires the sitemap to list exactly the three public routes', () => {
    write('sitemap.xml', `<loc>${HOME}/</loc><loc>${HOME}/reclutador/</loc>`);
    const found = run().filter((v) => v.includes('sitemap.xml'));
    expect(found.join('\n')).toContain('/experiencia/');
    expect(found.join('\n')).toContain('/reclutador/');
  });

  it('requires robots.txt to reference the sitemap and block nothing', () => {
    write('robots.txt', 'User-Agent: *\nDisallow: /reclutador/\n');
    const found = run().filter((v) => v.includes('robots.txt'));
    expect(found.some((v) => v.includes('Sitemap'))).toBe(true);
    expect(found.some((v) => v.includes('Disallow'))).toBe(true);
  });

  it('accepts the empty "Disallow:" that means allow everything', () => {
    write(
      'robots.txt',
      `User-Agent: *\nDisallow:\nSitemap: ${HOME}/sitemap.xml\n`,
    );
    expect(run()).toEqual([]);
  });

  it('requires content hashes in the file names of chunks (immutable cache)', () => {
    write('_next/static/chunks/app.js', '');
    expect(
      run().some((v) => v.includes('chunks/app.js') && v.includes('hash')),
    ).toBe(true);
  });

  it('fails when the documented routes differ from the generated ones', () => {
    write('nueva/index.html', '<html></html>');
    fs.writeFileSync(doc, DOC.replace('- `/reclutador/`\n', ''));
    const found = run().join('\n');
    expect(found).toContain('/nueva/');
    expect(found).toContain('/reclutador/');
  });
});

describe('self-hosted fonts', () => {
  it('requires at least one .woff2 under _next/static', () => {
    fs.rmSync(path.join(out, '_next/static/media'), { recursive: true });
    expect(run()).toEqual([expect.stringContaining('.woff2')]);
  });

  it('ignores a .woff2 outside _next/static', () => {
    fs.rmSync(path.join(out, '_next/static/media'), { recursive: true });
    write('fonts/stray.woff2', 'font');
    expect(run()).toEqual([expect.stringContaining('.woff2')]);
  });
});

describe('duplicate 404 page', () => {
  it('rejects out/404/ (the build prunes it; 404.html is the page)', () => {
    write('404/index.html', '<html></html>');
    expect(run()).toContain('unexpected 404/ (duplicate of 404.html)');
  });
});

describe('route helpers', () => {
  it('derives routes from index.html files, ignoring Next internals', () => {
    expect(generatedRoutes(out)).toEqual([
      '/',
      '/acceso/',
      '/acceso/verificar/',
      '/experiencia/',
      '/reclutador/',
    ]);
  });

  it('reads only the "Rutas generadas" section of the document', () => {
    expect(documentedRoutes(DOC)).toEqual([
      '/',
      '/acceso/',
      '/acceso/verificar/',
      '/experiencia/',
      '/reclutador/',
    ]);
  });
});

describe('command line', () => {
  const script = path.join(__dirname, 'check-out.js');
  const cli = () =>
    spawnSync(process.execPath, [script, out, '--doc', doc], {
      encoding: 'utf8',
    });

  it('exits 0 on a clean export', () => {
    expect(cli().status).toBe(0);
  });

  it('checks the positional dir when --doc is absent', () => {
    const missing = path.join(root, 'nonexistent');
    const result = spawnSync(process.execPath, [script, missing], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('out directory not found');
    expect(result.stderr).toContain(missing);
  });

  it('checks a valid positional dir without --doc (default contract)', () => {
    const result = spawnSync(process.execPath, [script, out], {
      encoding: 'utf8',
    });
    // The default contract lists the real routes, which the fake out/ matches.
    expect(result.stdout + result.stderr).toContain('check-out');
    expect(result.stderr).not.toContain('out directory not found');
  });

  it('accepts --doc before the positional dir', () => {
    const result = spawnSync(process.execPath, [script, '--doc', doc, out], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it('exits 1 and names the offending file', () => {
    fs.rmSync(path.join(out, 'acceso/verificar/index.html'));
    const result = cli();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing acceso/verificar/index.html');
  });
});
