/** @jest-environment node */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createServer, resolveFile } = require('./serve-out');

describe('serve-out', () => {
  let root;
  let outDir;
  let server;
  let base;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-out-'));
    outDir = path.join(root, 'out');
    fs.mkdirSync(path.join(outDir, 'acceso'), { recursive: true });
    fs.mkdirSync(path.join(outDir, '_next', 'static'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), '<h1>home</h1>');
    fs.writeFileSync(
      path.join(outDir, 'acceso', 'index.html'),
      '<h1>acceso</h1>',
    );
    fs.writeFileSync(path.join(outDir, '404.html'), '<h1>missing</h1>');
    fs.writeFileSync(path.join(outDir, '_next', 'static', 'app.js'), 'void 0;');
    fs.writeFileSync(path.join(root, 'secret.txt'), 'secret');
    server = createServer(outDir);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('serves index.html for directory routes', async () => {
    const home = await fetch(`${base}/`);
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/html');
    expect(await home.text()).toBe('<h1>home</h1>');

    const acceso = await fetch(`${base}/acceso/`);
    expect(await acceso.text()).toBe('<h1>acceso</h1>');
  });

  it('redirects a directory without trailing slash (trailingSlash: true)', async () => {
    const res = await fetch(`${base}/acceso`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/acceso/');
  });

  it('serves assets with their content type and ignores the query string', async () => {
    const res = await fetch(`${base}/_next/static/app.js?v=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/javascript');
  });

  it('answers 404 with 404.html for unknown routes', async () => {
    const res = await fetch(`${base}/nope/`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('<h1>missing</h1>');
  });

  it('never serves files outside the output directory', async () => {
    expect(resolveFile(outDir, '/%2e%2e/secret.txt')).toBeNull();
    const status = await new Promise((resolve) => {
      http.get(
        {
          host: '127.0.0.1',
          port: server.address().port,
          path: '/../secret.txt',
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
    });
    expect(status).toBe(404);
  });

  it('rejects malformed URL encoding', () => {
    expect(resolveFile(outDir, '/%E0%A4%A')).toBeNull();
  });

  function rawGet(method, reqPath) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: server.address().port,
          method,
          path: reqPath,
        },
        (res) => {
          res.resume();
          resolve(res);
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  it('never emits a protocol-relative Location (open redirect)', async () => {
    const res = await rawGet('GET', '/%2Facceso');
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.startsWith('//')).toBe(false);
    expect(res.headers.location).toBe('/acceso/');
    const many = await rawGet('GET', '/%2F%2F%2Facceso');
    expect(many.headers.location).toBe('/acceso/');
  });

  it('rejects paths with CR/LF with 400', async () => {
    const res = await rawGet('GET', '/acceso%0d%0aX-Evil:1');
    expect(res.statusCode).toBe(400);
    expect(res.headers['x-evil']).toBeUndefined();
  });

  it('answers 405 with Allow for methods other than GET/HEAD', async () => {
    const res = await rawGet('POST', '/');
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET, HEAD');
    const head = await rawGet('HEAD', '/');
    expect(head.statusCode).toBe(200);
  });

  it('survives a read stream error with a 500', async () => {
    fs.writeFileSync(path.join(outDir, 'broken.txt'), 'x');
    const spy = jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
      const { Readable } = require('node:stream');
      const stream = new Readable({
        read() {
          this.destroy(new Error('boom'));
        },
      });
      return stream;
    });
    try {
      const res = await rawGet('GET', '/broken.txt');
      expect(res.statusCode).toBe(500);
    } finally {
      spy.mockRestore();
    }
    const ok = await rawGet('GET', '/');
    expect(ok.statusCode).toBe(200);
  });

  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
    ['map', 'application/json'],
    ['webmanifest', 'application/manifest+json'],
  ])('serves .%s as %s', async (ext, type) => {
    fs.writeFileSync(path.join(outDir, `f.${ext}`), 'x');
    const res = await rawGet('GET', `/f.${ext}`);
    expect(res.headers['content-type']).toContain(type);
  });
});
