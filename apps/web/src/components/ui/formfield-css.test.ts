import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'FormField.module.css'), 'utf8');
const rule = (selector: string) =>
  css.match(
    new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`),
  )?.[1];

describe('FormField input styles', () => {
  const input = rule('.input');

  it('is a 48px tap target', () => {
    expect(input).toMatch(/min-height:\s*var\(--tap-48\)/);
  });

  it('uses at least 16px so iOS does not zoom on focus', () => {
    const size = Number(/font-size:\s*(\d+)px/.exec(input ?? '')?.[1]);
    expect(size).toBeGreaterThanOrEqual(16);
  });

  it('is bordered on the surface color, never directly on the page background', () => {
    expect(input).toMatch(/border:\s*1px solid var\(--color-border-strong\)/);
    expect(input).toMatch(/background:\s*var\(--color-surface\)/);
  });
});
