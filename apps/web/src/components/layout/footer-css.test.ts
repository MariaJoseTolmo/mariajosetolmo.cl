import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'Footer.module.css'), 'utf8');

describe('Footer.module.css', () => {
  it('gives footer links a 44px tap target', () => {
    const rule = /\.links a\s*{([^}]*)}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/display:\s*inline-flex/);
    expect(rule).toMatch(/align-items:\s*center/);
    expect(rule).toMatch(/min-height:\s*var\(--tap-44\)/);
  });
});
