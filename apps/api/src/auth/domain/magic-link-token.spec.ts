import { InvalidToken } from '../../shared/domain/errors';
import { sha256Hex } from '../../shared/domain/hash';
import { MalformedToken } from './auth-errors';
import { MagicLinkToken, magicLinkUrl } from './magic-link-token';
import type { ByteSource } from './opaque-token';

const random = (fill: number): ByteSource => ({
  bytes: (length) => new Uint8Array(length).fill(fill),
});

describe('MagicLinkToken', () => {
  it('generates 43 base64url characters and the hash of exactly that text', () => {
    const token = MagicLinkToken.generate(random(7));
    expect(token.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.hash).toBe(sha256Hex(token.value));
    expect(token.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives different tokens (and hashes) for different randomness', () => {
    const a = MagicLinkToken.generate(random(1));
    const b = MagicLinkToken.generate(random(2));
    expect(a.value).not.toBe(b.value);
    expect(a.hash).not.toBe(b.hash);
  });

  it('parses a well-formed token back to the same hash', () => {
    const generated = MagicLinkToken.generate(random(9));
    expect(MagicLinkToken.parse(generated.value).hash).toBe(generated.hash);
  });

  it.each([
    ['garbage', 'basura'],
    ['42 characters', 'a'.repeat(42)],
    ['44 characters', 'a'.repeat(44)],
    ['padded', `${'a'.repeat(42)}=`],
    ['whitespace around', ` ${'a'.repeat(43)} `],
    ['empty', ''],
    ['not a string', 12345],
    ['missing', undefined],
  ])('rejects %s as malformed (a 400)', (_label, raw) => {
    expect(() => MagicLinkToken.parse(raw)).toThrow(MalformedToken);
    expect(() => MagicLinkToken.parse(raw)).toThrow(InvalidToken);
  });

  it('never echoes the rejected value in the error', () => {
    expect(() => MagicLinkToken.parse('basura-secreta')).toThrow(
      'token is malformed',
    );
  });
});

describe('magicLinkUrl', () => {
  const token = 'T'.repeat(43);

  it('puts the token in the fragment, never in the query', () => {
    const url = magicLinkUrl(
      'https://app.example.test/acceso/verificar/',
      token,
    );
    expect(url).toBe(
      `https://app.example.test/acceso/verificar/#token=${token}`,
    );
    expect(url).not.toContain('?token=');
  });

  it('keeps the trailing slash the page needs, and drops query and fragment of the base', () => {
    expect(magicLinkUrl('http://127.0.0.1:3001/acceso/verificar', token)).toBe(
      `http://127.0.0.1:3001/acceso/verificar/#token=${token}`,
    );
    expect(
      magicLinkUrl('https://app.example.test/acceso/verificar/?x=1#old', token),
    ).toBe(`https://app.example.test/acceso/verificar/#token=${token}`);
  });
});
