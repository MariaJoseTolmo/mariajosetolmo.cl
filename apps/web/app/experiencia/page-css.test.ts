import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'page.module.css'), 'utf8');

describe('experiencia page.module.css', () => {
  it('keeps the mockup 96px bottom padding on mobile (only top and gap change)', () => {
    const base = /^\.page\s*{([^}]*)}/m.exec(css)?.[1] ?? '';
    expect(base).toMatch(/padding:\s*48px 24px 96px;/);
    expect(base).toMatch(/gap:\s*40px;/);
  });

  it('applies the desktop top padding and gap from 761px', () => {
    const desktop = css.split('@media (min-width: 761px)')[1] ?? '';
    expect(desktop).toMatch(/gap:\s*56px/);
    expect(desktop).toMatch(/padding:\s*var\(--space-section-page\) 24px 96px/);
  });
});
