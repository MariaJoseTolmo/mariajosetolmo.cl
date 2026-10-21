import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const webRoot = join(__dirname, '..', '..');
/** The only file allowed to talk to the network. */
const ALLOWED = ['src/lib/api/http.ts'];
const FETCH_CALL = /(?<![\w$.])fetch\s*\(/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('network access', () => {
  it('only lib/api/http.ts calls fetch()', () => {
    const offenders = ['src', 'app']
      .flatMap((dir) => walk(join(webRoot, dir)))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file))
      .filter((file) => FETCH_CALL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(webRoot, file))
      .sort();
    expect(offenders).toEqual(ALLOWED);
  });

  it('the pattern matches real calls and ignores lookalikes', () => {
    expect(FETCH_CALL.test('await fetch("/x")')).toBe(true);
    expect(FETCH_CALL.test('globalThis.fetch(x)')).toBe(false);
    expect(FETCH_CALL.test('prefetch(x)')).toBe(false);
  });
});
