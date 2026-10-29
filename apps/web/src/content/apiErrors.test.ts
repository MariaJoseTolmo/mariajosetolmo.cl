import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiErrors } from './apiErrors';

const OFFICIAL_SITE =
  'La solicitud no llegó desde el sitio oficial. Abre mariajosetolmo.cl directamente e inténtalo de nuevo.';

const source = readFileSync(join(__dirname, 'apiErrors.ts'), 'utf8');

describe('api error copy source', () => {
  it('has no literal figures, so times can only come from placeholders', () => {
    expect(source).not.toMatch(/\d/);
  });

  it.each([
    /renta/i,
    /\/status/i,
    /cloudfront/i,
    /\b(?:enero|marzo|agosto)\b/i,
  ])('never mentions %s', (pattern) => {
    expect(source).not.toMatch(pattern);
  });

  it('never leaks the CDN or header vocabulary in any text', () => {
    const texts = [
      ...Object.values(apiErrors.reasons),
      ...Object.values(apiErrors.kinds),
      apiErrors.waitUnknown,
      ...Object.values(apiErrors.wait),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/cloudfront|cdn|origin|viewer|header/i);
    }
  });
});

describe('403 copy', () => {
  it('uses the official-site text for CDN_REQUIRED and ORIGIN_NOT_ALLOWED', () => {
    expect(apiErrors.reasons.CDN_REQUIRED).toBe(OFFICIAL_SITE);
    expect(apiErrors.reasons.ORIGIN_NOT_ALLOWED).toBe(OFFICIAL_SITE);
  });

  it('gives ROLE_NOT_ALLOWED its own text', () => {
    expect(apiErrors.reasons.ROLE_NOT_ALLOWED).not.toBe(OFFICIAL_SITE);
    expect(apiErrors.reasons.ROLE_NOT_ALLOWED).not.toContain('sitio oficial');
  });

  it('keeps the code-less 403 distinct from both', () => {
    expect(apiErrors.kinds.forbidden).not.toBe(OFFICIAL_SITE);
    expect(apiErrors.kinds.forbidden).not.toBe(
      apiErrors.reasons.ROLE_NOT_ALLOWED,
    );
  });

  it('has no empty text anywhere', () => {
    for (const text of [
      ...Object.values(apiErrors.reasons),
      ...Object.values(apiErrors.kinds),
    ]) {
      expect(text.trim()).not.toBe('');
    }
  });
});
