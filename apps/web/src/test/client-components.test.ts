import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const webRoot = join(__dirname, '..', '..');
const USE_CLIENT = /^\s*(['"])use client\1/m;

/** Allowed Client Components. Future PRs extend this list deliberately. */
const ALLOWED = [
  'src/components/layout/MobileMenu.tsx',
  'src/features/login/LoginContainer.tsx',
  'src/features/login/VerifyContainer.tsx',
  'src/features/recruiter/RecruiterZone.tsx',
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('Client Components limit', () => {
  it('only the allowed files declare "use client"', () => {
    const found = ['src', 'app']
      .flatMap((dir) => walk(join(webRoot, dir)))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\./.test(file))
      .filter((file) => USE_CLIENT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(webRoot, file))
      .sort();
    expect(found).toEqual([...ALLOWED].sort());
  });
});
