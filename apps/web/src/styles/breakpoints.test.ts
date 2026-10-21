import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const srcRoot = join(__dirname, '..');
const PAGE_BREAKPOINT = '(min-width: 761px)';
const HEADER_BREAKPOINT = '(min-width: 900px)';
/** The header switches to the full nav later than the page (design §5). */
const HEADER_FILES = ['SiteHeader.module.css', 'MobileMenu.module.css'];

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const files = cssFiles(srcRoot).filter((file) => !file.endsWith('tokens.css'));

describe('responsive breakpoints', () => {
  it('scans the component stylesheets', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [relative(srcRoot, file), file]))(
    '%s only uses the page breakpoint (mobile-first)',
    (_name, file) => {
      const css = readFileSync(file, 'utf8');
      const queries = Array.from(css.matchAll(/@media\s+([^{]+)\{/g)).map(
        (match) => match[1]!.trim(),
      );
      const isHeader = HEADER_FILES.some((name) => file.endsWith(name));
      const allowed = [
        PAGE_BREAKPOINT,
        '(prefers-reduced-motion: reduce)',
        ...(isHeader ? [HEADER_BREAKPOINT] : []),
      ];
      for (const query of queries) {
        expect(allowed).toContain(query);
      }
    },
  );
});
