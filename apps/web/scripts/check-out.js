// Verifies the static export in `out/` against the delivery contract.
// Usage: node scripts/check-out.js [outDir] [--doc path/to/delivery-contract.md]
// CommonJS on purpose: Jest runs it without `--experimental-vm-modules`.
const fs = require('node:fs');
const path = require('node:path');

const SITE_URL = 'https://mariajosetolmo.cl';
const PUBLIC_ROUTES = ['/', '/experiencia/', '/acceso/'];
const PRIVATE_PAGES = ['acceso/verificar/index.html', 'reclutador/index.html'];
const REQUIRED_FILES = [
  'index.html',
  'experiencia/index.html',
  'acceso/index.html',
  ...PRIVATE_PAGES,
  '404.html',
  'robots.txt',
  'sitemap.xml',
];
// Routes Next writes for its own use; they are not site pages.
const INTERNAL_ROUTES = new Set(['404', '_not-found']);
const TEXT_FILE = /\.(html|js|css|txt|xml|json)$/;
const DOCUMENT_FILE = /\.(pdf|docx?|odt)$/i;
const FORBIDDEN_TEXT = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  // Mock adapter leaks (see src/lib/api/mock): none may reach production.
  '__WEB_CV_MOCK__',
  'Simular: abrir el enlace',
  'Reiniciar demo',
  'mock-token',
];
const NOINDEX = /<meta name="robots" content="noindex/;
const DEFAULT_DOC = path.join(__dirname, '..', 'docs', 'delivery-contract.md');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const toPosix = (file) => file.split(path.sep).join('/');

/** Routes of the exported pages, e.g. `/acceso/verificar/`. */
function generatedRoutes(outDir) {
  return walk(outDir)
    .map((file) => toPosix(path.relative(outDir, file)))
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => file.slice(0, -'index.html'.length))
    .filter((dir) => !INTERNAL_ROUTES.has(dir.split('/')[0]))
    .map((dir) => `/${dir}`)
    .sort();
}

/** Routes listed under "## Rutas generadas" in the contract document. */
function documentedRoutes(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^##\s+Rutas generadas/.test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n');
  const routes = [...section.matchAll(/`(\/[^`\s]*)`/g)].map((m) => m[1]);
  return [...new Set(routes)].sort();
}

const read = (outDir, rel) => fs.readFileSync(path.join(outDir, rel), 'utf8');
const exists = (outDir, rel) => fs.existsSync(path.join(outDir, rel));

function checkStructure(outDir) {
  const violations = REQUIRED_FILES.filter((rel) => !exists(outDir, rel)).map(
    (rel) => `missing ${rel}`,
  );
  const statics = path.join(outDir, '_next', 'static');
  if (!fs.existsSync(statics) || !fs.statSync(statics).isDirectory()) {
    violations.push('missing _next/static/');
  } else if (!walk(statics).some((file) => file.endsWith('.woff2'))) {
    // Fonts are self-hosted by next/font; none means they were not bundled.
    violations.push('missing self-hosted font: no .woff2 under _next/static/');
  }
  return violations;
}

// Next also writes 404/index.html next to 404.html; `prune-out.js` removes it
// after the build so there is a single error page.
function checkDuplicates(outDir) {
  return exists(outDir, '404')
    ? ['unexpected 404/ (duplicate of 404.html)']
    : [];
}

function checkFiles(outDir) {
  const violations = [];
  for (const file of walk(outDir)) {
    const rel = toPosix(path.relative(outDir, file));
    if (DOCUMENT_FILE.test(rel)) violations.push(`forbidden document: ${rel}`);
    if (!TEXT_FILE.test(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN_TEXT) {
      if (text.includes(needle)) {
        violations.push(`forbidden "${needle}" in ${rel}`);
      }
    }
    // Hashed names are what makes `immutable` caching safe.
    const hashedDir = /^_next\/static\/(chunks|media)\/[^/]+\.(js|css)$/;
    if (hashedDir.test(rel) && path.basename(rel).split('.')[0].length < 8) {
      violations.push(`${rel}: file name has no content hash`);
    }
  }
  return violations;
}

function checkDiscovery(outDir) {
  const violations = [];
  for (const rel of REQUIRED_FILES.filter((f) => f.endsWith('.html'))) {
    if (!exists(outDir, rel) || rel === '404.html') continue;
    const noindex = NOINDEX.test(read(outDir, rel));
    if (PRIVATE_PAGES.includes(rel) && !noindex) {
      violations.push(`${rel}: private page must carry noindex`);
    }
    if (!PRIVATE_PAGES.includes(rel) && noindex) {
      violations.push(`${rel}: public page must not carry noindex`);
    }
  }
  if (exists(outDir, 'sitemap.xml')) {
    const urls = [
      ...read(outDir, 'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g),
    ]
      .map((m) => m[1])
      .sort();
    const expected = PUBLIC_ROUTES.map((route) => `${SITE_URL}${route}`).sort();
    for (const url of expected.filter((u) => !urls.includes(u))) {
      violations.push(`sitemap.xml: missing ${url}`);
    }
    for (const url of urls.filter((u) => !expected.includes(u))) {
      violations.push(`sitemap.xml: unexpected ${url}`);
    }
  }
  if (exists(outDir, 'robots.txt')) {
    const robots = read(outDir, 'robots.txt');
    if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
      violations.push('robots.txt: must reference Sitemap');
    }
    // An empty "Disallow:" allows everything; a path would hide the noindex.
    if (/^disallow:[ \t]*\S/im.test(robots)) {
      violations.push('robots.txt: Disallow would hide the noindex pages');
    }
  }
  return violations;
}

function checkContract(outDir, docPath) {
  if (!fs.existsSync(docPath)) {
    return [`contract document not found: ${docPath}`];
  }
  const documented = documentedRoutes(fs.readFileSync(docPath, 'utf8'));
  const generated = generatedRoutes(outDir);
  return [
    ...generated
      .filter((r) => !documented.includes(r))
      .map((r) => `route ${r} is generated but not documented`),
    ...documented
      .filter((r) => !generated.includes(r))
      .map((r) => `route ${r} is documented but not generated`),
  ];
}

/** Every rule the export breaks, each naming the file at fault. */
function findViolations(outDir, { docPath = DEFAULT_DOC } = {}) {
  if (!fs.existsSync(outDir)) return [`out directory not found: ${outDir}`];
  return [
    ...checkStructure(outDir),
    ...checkDuplicates(outDir),
    ...checkFiles(outDir),
    ...checkDiscovery(outDir),
    ...checkContract(outDir, docPath),
  ];
}

function main(argv) {
  const docFlag = argv.indexOf('--doc');
  const docPath = docFlag === -1 ? DEFAULT_DOC : argv[docFlag + 1];
  // The value after --doc is the document, not the output directory.
  const outDir = argv.find(
    (arg, i) => !arg.startsWith('--') && (docFlag === -1 || i !== docFlag + 1),
  );
  const target = outDir ?? path.join(__dirname, '..', 'out');
  const violations = findViolations(target, { docPath });
  if (violations.length === 0) {
    console.log(`check-out: ${path.relative(process.cwd(), target) || '.'} OK`);
    return 0;
  }
  console.error(`check-out: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  - ${violation}`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { documentedRoutes, findViolations, generatedRoutes };
