import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_ROOTS, TOKENS_FILE, findRawColors } from '@/test/rawColors';

describe('raw color literals', () => {
  it('scans both src and app and finds none (tokens.css excepted)', () => {
    expect(DEFAULT_ROOTS.every((root) => existsSync(root))).toBe(true);
    expect(DEFAULT_ROOTS.map((root) => root.split('/').pop())).toEqual([
      'src',
      'app',
    ]);
    expect(findRawColors(DEFAULT_ROOTS)).toEqual([]);
  });

  it('pins the exemption to apps/web/src/styles/tokens.css', () => {
    expect(TOKENS_FILE.endsWith('apps/web/src/styles/tokens.css')).toBe(true);
  });

  describe('detection', () => {
    let dir: string;
    const scan = (tokensFile?: string) =>
      findRawColors([join(dir, 'src'), join(dir, 'app')], {
        base: dir,
        tokensFile,
      });

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'raw-colors-'));
      mkdirSync(join(dir, 'src', 'styles'), { recursive: true });
      mkdirSync(join(dir, 'app'));
    });

    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it.each([
      ['src/a.module.css', 'a { color: #abc; }'],
      ['src/b.module.css', 'a { color: #6D5BDF; }'],
      ['src/c.module.css', 'a { color: rgb(0 0 0); }'],
      ['src/d.module.css', 'a { color: hsl(10 10% 10%); }'],
      ['app/x.css', 'a { background: #fff }'],
      ['app/y.module.css', 'a { color: oklch(0.5 0.1 200); }'],
      ['src/e.module.css', 'a { color: lab(50% 10 10); }'],
      ['src/f.module.css', 'a { color: color-mix(in srgb, red, blue); }'],
      ['src/g.module.css', 'a { border: 1px solid black; }'],
      ['src/h.module.css', 'a { color: Red; }'],
      ['src/i.module.css', 'a { color: grey; }'],
      ['src/j.tsx', 'export const c = "#6D5BDF";'],
      ['src/k.ts', 'export const c = "#6D5BDF";'],
      ['app/l.ts', "export const c = 'rgba(0,0,0,.5)';"],
      ['src/m.ts', 'export const c = "border: 1px solid white";'],
      ['src/n.ts', 'export const c = "color: #fff";'],
    ])('reports %s', (name, content) => {
      writeFileSync(join(dir, name), content);
      expect(scan()).toEqual([name]);
    });

    it('does not treat bare variant names in TS as colors', () => {
      writeFileSync(join(dir, 'src', 'v.ts'), 'export const v = "green";');
      expect(scan()).toEqual([]);
    });

    it('allows transparent, currentColor, inherit and var()', () => {
      writeFileSync(
        join(dir, 'src', 'ok.module.css'),
        `a { color: inherit; background: transparent; border-color: currentColor;
          outline: 2px solid var(--color-white); fill: var(--color-green); }`,
      );
      expect(scan()).toEqual([]);
    });

    it('does not flag anchors or ids that look like hex', () => {
      writeFileSync(
        join(dir, 'src', 'anchor.tsx'),
        'export const a = <a href="#add">x</a>;',
      );
      writeFileSync(
        join(dir, 'src', 'anchor.module.css'),
        'a:not(.x) #add { margin: 0 }\n#bad { margin: 0 }',
      );
      writeFileSync(
        join(dir, 'app', 'ok.ts'),
        'export const h = "#contenido";',
      );
      expect(scan()).toEqual([]);
    });

    it('exempts only the given tokens file, not other tokens.css', () => {
      const tokens = join(dir, 'src', 'styles', 'tokens.css');
      writeFileSync(tokens, ':root { --c: #fff; }');
      writeFileSync(join(dir, 'app', 'tokens.css'), ':root { --c: #fff; }');
      writeFileSync(join(dir, 'x.test.tsx'), 'const c = "#fff";');
      expect(scan(tokens)).toEqual(['app/tokens.css']);
    });
  });
});
