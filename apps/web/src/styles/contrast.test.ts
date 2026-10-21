import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contrastRatio,
  findFailingPairs,
  parseColorTokens,
} from '@/test/contrast';

const css = readFileSync(join(__dirname, 'tokens.css'), 'utf8');
const tokens = parseColorTokens(css);

const EXPECTED_TOKENS = [
  'bg',
  'surface',
  'ink',
  'ink-2',
  'muted',
  'border',
  'border-strong',
  'accent',
  'accent-hover',
  'green',
  'code-string',
  'dark-border',
  'dark-active',
  'on-dark',
  'on-dark-2',
  'on-dark-muted',
];

describe('tokens.css', () => {
  it('defines the 16 design colors plus white', () => {
    expect(Object.keys(tokens).sort()).toEqual(
      [...EXPECTED_TOKENS, 'white'].sort(),
    );
  });

  it('keeps accent on bg above the AA text threshold', () => {
    expect(
      contrastRatio(tokens.accent as string, tokens.bg as string),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('contrast pairs', () => {
  it('all pairs meet their WCAG threshold', () => {
    expect(findFailingPairs(tokens)).toEqual([]);
  });

  it('names the offending pair when a token is degraded', () => {
    const degraded = { ...tokens, accent: '#8A7BE8' };
    const failing = findFailingPairs(degraded);
    expect(
      failing.some((f) => f.startsWith('--color-accent on --color-bg')),
    ).toBe(true);
  });

  it('computes known WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});
