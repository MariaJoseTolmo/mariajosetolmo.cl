import { CryptoIdGenerator } from './crypto-id.generator';
import { CryptoRandomSource } from './crypto-random.source';

describe('CryptoRandomSource', () => {
  it('returns exactly the requested number of bytes', () => {
    const source = new CryptoRandomSource();
    expect(source.bytes(32)).toHaveLength(32);
    expect(source.bytes(5)).toHaveLength(5);
  });

  it('returns different bytes on each call', () => {
    const source = new CryptoRandomSource();
    expect(
      Buffer.from(source.bytes(32)).equals(Buffer.from(source.bytes(32))),
    ).toBe(false);
  });
});

describe('CryptoIdGenerator', () => {
  it('generates unique v4 UUIDs', () => {
    const generator = new CryptoIdGenerator();
    const first = generator.uuid();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(generator.uuid()).not.toBe(first);
  });
});
