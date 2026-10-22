import { sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('hashes the empty string to the standard digest', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hashes "abc" to the standard digest as 64 lowercase hex chars', () => {
    const digest = sha256Hex('abc');
    expect(digest).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic and sensitive to a single character', () => {
    expect(sha256Hex('token-a')).toBe(sha256Hex('token-a'));
    expect(sha256Hex('token-a')).not.toBe(sha256Hex('token-b'));
  });

  it('hashes multi-byte input as UTF-8', () => {
    expect(sha256Hex('ñ')).toBe(
      '024bb90888ca89a15a19e9bdd8c712bfb070465fce1ef25e43c170ea44fc5e5f',
    );
  });
});
