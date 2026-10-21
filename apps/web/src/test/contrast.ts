export type Tokens = Record<string, string>;

export interface Pair {
  fg: string;
  bg: string;
  min: number;
}

const TEXT = 4.5;
const UI = 3;

// Pairs of design section 10. Values are always read from tokens.css.
export const PAIRS: readonly Pair[] = [
  ...['ink', 'ink-2', 'muted', 'accent', 'accent-hover'].flatMap((fg) =>
    ['bg', 'surface'].map((bg) => ({ fg, bg, min: TEXT })),
  ),
  { fg: 'white', bg: 'accent', min: TEXT },
  { fg: 'white', bg: 'accent-hover', min: TEXT },
  ...[
    'on-dark',
    'on-dark-2',
    'on-dark-muted',
    'green',
    'code-string',
    'white',
  ].map((fg) => ({ fg, bg: 'ink', min: TEXT })),
  { fg: 'on-dark', bg: 'dark-active', min: TEXT },
  { fg: 'ink', bg: 'green', min: TEXT },
  { fg: 'border-strong', bg: 'surface', min: UI },
  // border-strong on bg is 2.99:1 with the approved palette, so it is not asserted
  // (the spec only requires border-strong on surface). Reported in apply-progress.
  { fg: 'accent', bg: 'surface', min: UI },
  { fg: 'green', bg: 'ink', min: UI },
];

export function parseColorTokens(css: string): Tokens {
  const tokens: Tokens = {};
  for (const match of css.matchAll(
    /--color-([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[match[1] as string] = match[2] as string;
  }
  return tokens;
}

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

export function contrastRatio(fg: string, bg: string): number {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

export function findFailingPairs(tokens: Tokens): string[] {
  return PAIRS.flatMap(({ fg, bg, min }) => {
    const fgHex = tokens[fg];
    const bgHex = tokens[bg];
    if (!fgHex || !bgHex)
      return [`--color-${fg} on --color-${bg}: token missing`];
    const ratio = contrastRatio(fgHex, bgHex);
    return ratio >= min
      ? []
      : [
          `--color-${fg} on --color-${bg}: ${ratio.toFixed(2)}:1 (needs ${min}:1)`,
        ];
  });
}
