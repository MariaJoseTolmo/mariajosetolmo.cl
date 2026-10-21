import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8');

/** The header switches to the full nav at 900px (the page breakpoint stays 761px). */
describe('header breakpoint', () => {
  it.each(['SiteHeader.module.css', 'MobileMenu.module.css'])(
    '%s switches at min-width 900px and not at 761px',
    (name) => {
      const css = read(name);
      expect(css).toMatch(/@media \(min-width: 900px\)/);
      expect(css).not.toMatch(/761px/);
    },
  );
});
