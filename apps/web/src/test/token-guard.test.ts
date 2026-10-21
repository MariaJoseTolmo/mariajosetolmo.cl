import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const webRoot = join(__dirname, '..', '..');
/** The only file allowed to read the URL (where the magic-link token lives). */
const ALLOWED = ['src/features/login/useMagicLinkToken.ts'];
const READS_URL =
  /location\.(hash|search|href)|document\.URL|useSearchParams|searchParams|useParams|location\.toString/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('magic-link token handling', () => {
  it('only useMagicLinkToken.ts reads the URL fragment or query', () => {
    const offenders = ['src', 'app']
      .flatMap((dir) => walk(join(webRoot, dir)))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file))
      .filter((file) => READS_URL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(webRoot, file))
      .sort();
    expect(offenders).toEqual(ALLOWED);
  });

  it('the pattern catches the usual ways of reading the token', () => {
    expect(READS_URL.test('window.location.hash')).toBe(true);
    expect(READS_URL.test('location.search')).toBe(true);
    expect(READS_URL.test('useSearchParams()')).toBe(true);
    expect(READS_URL.test('window.location.href')).toBe(true);
    expect(READS_URL.test('document.URL')).toBe(true);
    expect(READS_URL.test('useParams()')).toBe(true);
    expect(READS_URL.test('location.toString()')).toBe(true);
    expect(READS_URL.test('location.pathname')).toBe(false);
    expect(READS_URL.test('window.location.assign(url)')).toBe(false);
  });
});
