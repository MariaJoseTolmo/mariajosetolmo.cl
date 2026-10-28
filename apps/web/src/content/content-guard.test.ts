import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { MOCK_ME } from '@/lib/api/mock/fixtures';
import {
  availabilityMatches,
  findDocuments,
  moneyMatches,
  phoneMatches,
} from '@/test/contentRules';

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

// Money and phone rules run over the shipped source: pages, features,
// components, content and the mock fixtures. src/test holds the rules themselves.
const shippedSource = ['app', 'src']
  .flatMap((dir) => walk(join(WEB_ROOT, dir)))
  .filter(
    (file) =>
      /\.(ts|tsx)$/.test(file) &&
      !isTest(file) &&
      !file.includes(`${join('src', 'test')}/`),
  )
  .map((file) => relative(WEB_ROOT, file));

describe('money, phone and documents', () => {
  it('scans the mock fixtures too', () => {
    expect(shippedSource).toContain('src/lib/api/mock/fixtures.ts');
  });

  it.each(shippedSource)('%s has no salary or money wording', (name) => {
    expect(moneyMatches(readFileSync(join(WEB_ROOT, name), 'utf8'))).toEqual(
      [],
    );
  });

  it.each(shippedSource.filter((name) => name !== 'src/content/site.ts'))(
    '%s has no phone number (only src/content/site.ts may)',
    (name) => {
      expect(phoneMatches(readFileSync(join(WEB_ROOT, name), 'utf8'))).toEqual(
        [],
      );
    },
  );

  it.each(shippedSource)('%s has no availability date', (name) => {
    expect(
      availabilityMatches(readFileSync(join(WEB_ROOT, name), 'utf8')),
    ).toEqual([]);
  });

  it('ships no PDF, Word or ODT document under apps/web', () => {
    expect(findDocuments(WEB_ROOT)).toEqual([]);
  });

  describe('the rules do catch violations', () => {
    it.each([
      'Renta: $ 1500000',
      'Renta: $1.500.000',
      '2000000 CLP',
      '3 millones',
      '1,5MM',
      'Pretensión 1.500.000 pesos',
      '$1.500',
      '1.500 CLP',
      '2 millones',
      'sueldo 1500000 pesos',
      'Sueldo líquido: 1500000',
      'pretensión de renta 1.500.000',
      'Remuneración deseada 900000',
      'salario 1,500,000',
    ])('money: %j', (text) => {
      expect(moneyMatches(text)).not.toEqual([]);
    });

    it.each([
      'Renta',
      '[RENTA]',
      'Node.js 24.15',
      '2000-01-01T00:00:00.000Z',
      'YYYY-MM-DD',
      'format: MM/DD/YYYY',
      'v1.234.567',
      'next 16.2.100.200',
      'version 1.234.567 of the lib',
      'sueldo',
      'sueldo a convenir',
      'renta 12',
      'rentabilidad 1500000',
      'timestamp 1792800000000',
    ])('money ignores %j', (text) => {
      expect(moneyMatches(text)).toEqual([]);
    });

    it.each([
      '+56 9 7453 6288',
      'tel:+56974536288',
      '9 7453 6288 x',
      '9-7453-6288',
      '(9) 7453 6288',
      '56912345678',
      '+56912345678',
      '912345678',
      '(+56) 9 1234 5678',
      'fono 56912345678.',
    ])('phone: %j', (text) => {
      expect(phoneMatches(text)).not.toEqual([]);
    });

    it.each([
      '1792800000000',
      'sha 9123456789',
      'id 5691234567890',
      'v9.12345678',
      '2000-01-01T00:00:00.000Z',
      '56 9',
    ])('phone ignores %j', (text) => {
      expect(phoneMatches(text)).toEqual([]);
    });

    it.each([
      'Disponible desde el 1 de marzo',
      'disponible inicio inmediato',
      'Disponibilidad desde enero',
      'Inicio: 01/03/2027',
      'desde 1-3-27',
      'Disponible a partir de marzo 2027',
      'agosto de 2027',
      'Start in January 2027',
    ])('availability date: %j', (text) => {
      expect(availabilityMatches(text)).not.toEqual([]);
    });

    it.each([
      'Disponibilidad',
      'Enlace no disponible',
      '2000-01-01T00:00:00.000Z',
      '2026-10-21',
      'v1.2.3',
      'next 16.2.100',
      '2023 – 2024 · remoto',
      'mayo es un mes',
      'Node 24-15-1',
    ])('availability ignores %j', (text) => {
      expect(availabilityMatches(text)).toEqual([]);
    });

    it('finds a document dropped in a temp tree, skipping build output', () => {
      const root = mkdtempSync(join(tmpdir(), 'content-guard-'));
      try {
        mkdirSync(join(root, 'public'));
        mkdirSync(join(root, 'out'));
        writeFileSync(join(root, 'public', 'cv.PDF'), 'x');
        writeFileSync(join(root, 'public', 'carta.docx'), 'x');
        writeFileSync(join(root, 'out', 'ignored.pdf'), 'x');
        writeFileSync(join(root, 'public', 'ok.txt'), 'x');
        expect(findDocuments(root).sort()).toEqual([
          'public/carta.docx',
          'public/cv.PDF',
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});

describe('mock availability placeholders', () => {
  const placeholders = Object.values(MOCK_ME.availability);

  it('has placeholders to look for', () => {
    expect(placeholders).toHaveLength(3);
    for (const value of placeholders) expect(value).not.toBe('');
  });

  it.each(contentFiles)(
    '%s never contains the mock availability values',
    (name) => {
      const raw = readFileSync(join(WEB_ROOT, name), 'utf8');
      for (const value of placeholders) expect(raw).not.toContain(value);
    },
  );
});
