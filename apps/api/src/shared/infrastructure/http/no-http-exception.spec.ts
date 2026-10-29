import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..', '..');
const THROWN_HTTP_EXCEPTION = /new \w+Exception\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

describe('error contract: one translation point', () => {
  it('never throws a Nest HttpException from application code', () => {
    const offenders = sourceFiles(SRC_ROOT).filter((file) =>
      THROWN_HTTP_EXCEPTION.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((f) => f.slice(SRC_ROOT.length))).toEqual([]);
  });

  it('would catch a throw of an HttpException (the pattern is live)', () => {
    expect(THROWN_HTTP_EXCEPTION.test('throw new ForbiddenException()')).toBe(
      true,
    );
  });
});
