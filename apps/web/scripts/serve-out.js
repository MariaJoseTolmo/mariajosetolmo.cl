// Tiny static server to preview the `out/` export locally (no dependencies).
// Usage: npm run preview -w apps/web   (after `npm run build -w apps/web`)
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 3002);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function statOf(file) {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}

/**
 * Maps a request path to a file inside `outDir`.
 * Returns an absolute file path, `{ redirect }` for a directory without a
 * trailing slash, `{ badRequest }` for control characters in the path, or
 * null when nothing (safe) matches.
 */
function resolveFile(outDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (/[\r\n]/.test(decoded)) return { badRequest: true };
  const target = path.join(outDir, decoded);
  if (target !== outDir && !target.startsWith(outDir + path.sep)) return null;
  const stat = statOf(target);
  if (stat?.isDirectory()) {
    if (!decoded.endsWith('/')) {
      // Collapse leading slashes so the Location can never be protocol-relative.
      const local = `/${decoded.replace(/^\/+/, '')}/`;
      return { redirect: encodeURI(local) };
    }
    const index = path.join(target, 'index.html');
    return statOf(index)?.isFile() ? index : null;
  }
  return stat?.isFile() ? target : null;
}

function send(req, res, status, file) {
  const headers = {
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
  };
  if (req.method === 'HEAD') {
    res.writeHead(status, headers);
    return res.end();
  }
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': TYPES['.txt'] });
      res.end('Internal error');
    } else {
      res.destroy();
    }
  });
  stream.on('open', () => res.writeHead(status, headers));
  stream.pipe(res);
}

function createServer(outDir) {
  const root = path.resolve(outDir);
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': TYPES['.txt'] });
      return res.end('Method not allowed');
    }
    // Not `new URL`: a request target like `//host/x` would be parsed as a host.
    const pathname = (req.url ?? '/').split(/[?#]/)[0] || '/';
    const match = resolveFile(root, pathname);
    if (typeof match === 'string') return send(req, res, 200, match);
    if (match?.badRequest) {
      res.writeHead(400, { 'Content-Type': TYPES['.txt'] });
      return res.end('Bad request');
    }
    if (match?.redirect) {
      res.writeHead(301, { Location: match.redirect });
      return res.end();
    }
    const notFound = path.join(root, '404.html');
    if (statOf(notFound)?.isFile()) return send(req, res, 404, notFound);
    res.writeHead(404, { 'Content-Type': TYPES['.txt'] });
    res.end('Not found');
  });
}

module.exports = { createServer, resolveFile };

if (require.main === module) {
  const outDir = path.join(__dirname, '..', 'out');
  if (!statOf(outDir)?.isDirectory()) {
    console.error('out/ not found. Run: npm run build -w apps/web');
    process.exit(1);
  }
  createServer(outDir).listen(PORT, '127.0.0.1', () => {
    console.log(`Preview of out/ at http://127.0.0.1:${PORT}/`);
  });
}
