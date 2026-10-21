import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'Hero.module.css'), 'utf8');

describe('Hero.module.css', () => {
  it('lets the h1 break long words instead of overflowing', () => {
    expect(css).toMatch(/\.title\s*{[^}]*overflow-wrap:\s*anywhere/);
  });
});
