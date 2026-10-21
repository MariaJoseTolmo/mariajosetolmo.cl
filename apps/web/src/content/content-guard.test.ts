import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const KAFKA_WITHOUT_SQS = /kafka(?! en local \/ SQS en producción)/i;

const FORBIDDEN_COPY = /\/status|\/api-docs|\bWord\b|agendar/i;

const WEB_ROOT = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const isTest = (file: string) => /\.test\.[jt]sx?$/.test(file);

const contentFiles = walk(__dirname)
  .filter((file) => file.endsWith('.ts') && !isTest(file))
  .map((file) => relative(WEB_ROOT, file));

// Hardcoded copy living in components and pages, not only in src/content.
const markupFiles = ['src/features', 'src/components', 'app']
  .flatMap((dir) => walk(join(WEB_ROOT, dir)))
  .filter((file) => file.endsWith('.tsx') && !isTest(file))
  .map((file) => relative(WEB_ROOT, file));

const scanned = [...contentFiles, ...markupFiles];

describe('content sources', () => {
  it('finds the content modules to scan', () => {
    expect(contentFiles).toEqual(
      expect.arrayContaining([
        'src/content/home.ts',
        'src/content/site.ts',
        'src/content/stack.ts',
        'src/content/projects.ts',
        'src/content/experience.ts',
      ]),
    );
  });

  it('finds the components and pages that hold hardcoded copy', () => {
    expect(markupFiles).toEqual(
      expect.arrayContaining([
        'src/features/home/ProjectsSection.tsx',
        'src/features/experience/Timeline.tsx',
        'src/components/layout/Footer.tsx',
        'app/page.tsx',
        'app/experiencia/page.tsx',
      ]),
    );
  });

  it.each(scanned)(
    '%s never mentions Kafka without "en local / SQS en producción" (any casing)',
    (name) => {
      const raw = readFileSync(join(WEB_ROOT, name), 'utf8');
      expect(raw).not.toMatch(KAFKA_WITHOUT_SQS);
    },
  );

  it.each(scanned)(
    '%s never links to /status or /api-docs nor offers Word or scheduling',
    (name) => {
      const raw = readFileSync(join(WEB_ROOT, name), 'utf8');
      expect(raw).not.toMatch(FORBIDDEN_COPY);
    },
  );
});
