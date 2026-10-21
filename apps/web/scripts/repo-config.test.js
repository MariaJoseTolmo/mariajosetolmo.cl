/** @jest-environment node */
const fs = require('node:fs');
const path = require('node:path');

const webRoot = path.join(__dirname, '..');
const repoRoot = path.join(webRoot, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');

describe('repo configuration guards', () => {
  it('fails lint on warnings so jsx-a11y warnings break CI', () => {
    const { scripts } = JSON.parse(read(repoRoot, 'package.json'));
    expect(scripts.lint).toMatch(/--max-warnings 0\b/);
  });

  it('scopes eslint build-output ignores to apps/web', () => {
    const config = read(repoRoot, 'eslint.config.mjs');
    expect(config).toContain("'apps/web/.next/**'");
    expect(config).toContain("'apps/web/out/**'");
    expect(config).toContain("'apps/web/next-env.d.ts'");
    expect(config).not.toMatch(/'\*\*\/(\.next|out)\/\*\*'/);
    expect(config).not.toContain("'**/next-env.d.ts'");
  });

  it('binds the dev server to localhost only', () => {
    const { scripts } = JSON.parse(read(webRoot, 'package.json'));
    expect(scripts.dev).toMatch(/-H 127\.0\.0\.1/);
  });

  it('takes the skip-link focus outline width from a token', () => {
    const css = read(
      webRoot,
      'src',
      'components',
      'layout',
      'SkipLink.module.css',
    );
    expect(css).not.toMatch(/\d+px\s+solid/);
    expect(css).toMatch(/outline:\s*var\(--focus-ring-width\)/);
    expect(read(webRoot, 'src', 'styles', 'tokens.css')).toMatch(
      /--focus-ring-width:\s*2px/,
    );
  });
});
