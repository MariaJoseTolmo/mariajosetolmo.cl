import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');

describe('globals.css', () => {
  it('draws a visible focus ring from the focus token', () => {
    expect(css).toMatch(
      /:focus-visible\s*{[^}]*outline:\s*var\(--focus-ring\)/,
    );
  });

  it('disables animations and transitions for reduced motion', () => {
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*)}\s*$/m.exec(css);
    expect(block?.[1]).toMatch(/transition-duration:\s*0\.01ms/);
    expect(block?.[1]).toMatch(/animation-duration:\s*0\.01ms/);
  });

  it('uses the font variables from next/font with a system fallback', () => {
    expect(css).toMatch(/font-family:\s*var\(--font-sans\),\s*system-ui/);
  });

  it('keeps global link rules at zero specificity so component classes win', () => {
    const selectors = [
      ...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^([^\s{}@][^{}]*)\{/gm),
    ].map((m) => (m[1] as string).trim());
    const links = selectors.filter((sel) => /\ba\b/.test(sel));
    expect(links.length).toBeGreaterThan(0);
    for (const sel of links) {
      expect(sel).toMatch(/^:where\(.+\)(:hover)?$/);
    }
  });
});
