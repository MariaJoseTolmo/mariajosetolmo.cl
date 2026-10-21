import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const HEX = '#[0-9a-fA-F]{3,8}\\b';
const COLOR_FN =
  '\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix|color)\\(';
// Keywords allowed anywhere: transparent, currentColor, inherit (not listed).
const NAMED = [
  'black',
  'white',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
  'cyan',
  'magenta',
  'silver',
  'gold',
  'navy',
  'teal',
  'lime',
  'maroon',
  'olive',
  'aqua',
  'fuchsia',
].join('|');
// Bare names in TS strings (variant: 'green') are not colors; only `prop: name` is.
const NAMED_WORD = `(?<![\\w-])(?:${NAMED})(?![\\w-])`;

const HEX_RE = new RegExp(HEX);
const FN_RE = new RegExp(COLOR_FN, 'i');
const NAMED_RE = new RegExp(NAMED_WORD, 'i');
const BARE_HEX_RE = new RegExp(`^\\s*${HEX}\\s*$`);
const CSS_CONTEXT_RE = new RegExp(
  `[\\w-]+\\s*:[^;]*(?:${HEX}|${NAMED_WORD})`,
  'i',
);
const NON_COLOR_ATTR_RE = /(?:href|id|htmlFor|name|to|aria-[\w-]+)\s*=\s*$/;

/** The only file where color literals are allowed. */
export const TOKENS_FILE = resolve(__dirname, '..', 'styles', 'tokens.css');

/** Default scan roots: apps/web/src and apps/web/app. */
export const DEFAULT_ROOTS = [
  resolve(__dirname, '..'),
  resolve(__dirname, '..', '..', 'app'),
];

function cssHasRawColor(source: string): boolean {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Declaration values only: `prop: value;` (selectors end in `{`, never match).
  for (const [, raw] of css.matchAll(/:([^;{}]*)[;}]/g)) {
    const value = (raw as string)
      .replace(/var\([^)]*\)/g, '')
      .replace(/url\([^)]*\)/g, '')
      .replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');
    if (HEX_RE.test(value) || FN_RE.test(value) || NAMED_RE.test(value))
      return true;
  }
  return false;
}

function scriptHasRawColor(source: string): boolean {
  for (const match of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const text = match[2] as string;
    const before = source.slice(0, match.index);
    if (NON_COLOR_ATTR_RE.test(before)) continue;
    if (BARE_HEX_RE.test(text) || FN_RE.test(text) || CSS_CONTEXT_RE.test(text))
      return true;
  }
  return false;
}

interface Options {
  /** Paths in the result are relative to this directory. */
  base?: string;
  /** Absolute path of the single exempt tokens file. */
  tokensFile?: string;
}

/**
 * Returns the files (relative to `base`) that contain a literal color, scanning
 * .css, .ts and .tsx under every root. Only `tokensFile` and tests are exempt.
 */
export function findRawColors(
  roots: string | readonly string[],
  { base, tokensFile = TOKENS_FILE }: Options = {},
): string[] {
  const list = typeof roots === 'string' ? [roots] : roots;
  const origin = base ?? dirname(resolve(list[0] as string));
  const found: string[] = [];
  for (const root of list) {
    for (const file of readdirSync(root, {
      recursive: true,
      encoding: 'utf8',
    })) {
      const full = resolve(root, file);
      if (full === tokensFile) continue;
      if (/\.test\.[jt]sx?$/.test(file)) continue;
      if (!/\.(css|tsx?)$/.test(file)) continue;
      if (/\.d\.ts$/.test(file)) continue;
      const source = readFileSync(join(root, file), 'utf8');
      const raw = file.endsWith('.css')
        ? cssHasRawColor(source)
        : scriptHasRawColor(source);
      if (raw) found.push(relative(origin, full));
    }
  }
  return found.sort();
}
