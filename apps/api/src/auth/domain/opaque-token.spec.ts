import {
  type ByteSource,
  generateOpaqueToken,
  isOpaqueToken,
} from './opaque-token';

function fixedRandom(fill: number): ByteSource & { requested: number[] } {
  const requested: number[] = [];
  return {
    requested,
    bytes(length) {
      requested.push(length);
      return new Uint8Array(length).fill(fill);
    },
  };
}

describe('generateOpaqueToken', () => {
  it('asks for 32 random bytes and encodes them as 43 base64url characters', () => {
    const random = fixedRandom(0xff);
    const token = generateOpaqueToken(random);
    expect(random.requested).toEqual([32]);
    expect(token).toBe('_'.repeat(42) + '8');
  });

  it('encodes different bytes differently, without padding', () => {
    const zero = generateOpaqueToken(fixedRandom(0));
    expect(zero).toBe('A'.repeat(43));
    expect(zero).not.toContain('=');
    expect(generateOpaqueToken(fixedRandom(1))).not.toBe(zero);
  });
});

describe('isOpaqueToken', () => {
  it.each([
    ['43 base64url characters', 'a'.repeat(43), true],
    ['with - and _', `-_${'B'.repeat(41)}`, true],
    ['42 characters', 'a'.repeat(42), false],
    ['44 characters', 'a'.repeat(44), false],
    ['padding', `${'a'.repeat(42)}=`, false],
    ['plus', `+${'a'.repeat(42)}`, false],
    ['slash', `/${'a'.repeat(42)}`, false],
    ['surrounding space', ` ${'a'.repeat(42)}`, false],
    ['newline at the end', `${'a'.repeat(43)}\n`, false],
    ['empty', '', false],
  ])('%s', (_label, value, expected) => {
    expect(isOpaqueToken(value)).toBe(expected);
  });

  it('rejects values that are not strings', () => {
    expect(isOpaqueToken(undefined)).toBe(false);
    expect(isOpaqueToken(42)).toBe(false);
    expect(isOpaqueToken({ token: 'a'.repeat(43) })).toBe(false);
  });
});
