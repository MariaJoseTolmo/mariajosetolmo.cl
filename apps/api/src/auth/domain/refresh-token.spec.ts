import { sha256Hex } from '../../shared/domain/hash';
import {
  RefreshToken,
  type RefusedTokenState,
  judgeRefusedRefresh,
} from './refresh-token';

const NOW = new Date('2026-01-03T12:00:00.000Z');
const secondsAgo = (seconds: number): Date =>
  new Date(NOW.getTime() - seconds * 1000);

const state = (
  overrides: Partial<RefusedTokenState> = {},
): RefusedTokenState => ({
  usedAt: null,
  revokedAt: null,
  ...overrides,
});

describe('RefreshToken', () => {
  const bytes = (fill: number): { bytes(length: number): Uint8Array } => ({
    bytes: (length) => new Uint8Array(length).fill(fill),
  });

  it('generates a 43 character base64url value and keeps the sha256 of it', () => {
    const token = RefreshToken.generate(bytes(1));
    expect(token.value).toBe(Buffer.alloc(32, 1).toString('base64url'));
    expect(token.value).toHaveLength(43);
    expect(token.hash).toBe(sha256Hex(token.value));
  });

  it('generates different tokens from different bytes', () => {
    expect(RefreshToken.generate(bytes(1)).value).not.toBe(
      RefreshToken.generate(bytes(2)).value,
    );
  });

  it('parses a well formed cookie value back to the same hash', () => {
    const generated = RefreshToken.generate(bytes(7));
    expect(RefreshToken.parse(generated.value)?.hash).toBe(generated.hash);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', { a: 1 }],
    ['empty', ''],
    ['too short', 'abc'],
    ['42 characters', 'A'.repeat(42)],
    ['44 characters', 'A'.repeat(44)],
    ['a bad character', `${'A'.repeat(42)}+`],
    ['a trailing newline', `${'A'.repeat(42)}\n`],
  ])('returns null (not an error) for %s', (_label, raw) => {
    expect(RefreshToken.parse(raw)).toBeNull();
  });
});

describe('judgeRefusedRefresh', () => {
  it('treats an unknown token as plain 401 and clears the cookies', () => {
    expect(judgeRefusedRefresh(null, NOW)).toEqual({
      revokeFamily: false,
      clearCookies: true,
    });
  });

  it('treats an unused token that `rotate` refused (family expired) as a 401 with cookies cleared', () => {
    expect(judgeRefusedRefresh(state(), NOW)).toEqual({
      revokeFamily: false,
      clearCookies: true,
    });
  });

  it('revokes the family of a revoked token', () => {
    expect(
      judgeRefusedRefresh(state({ revokedAt: secondsAgo(3600) }), NOW),
    ).toEqual({ revokeFamily: true, clearCookies: true });
  });

  it('revokes even when the revoked token was also used a moment ago', () => {
    expect(
      judgeRefusedRefresh(
        state({ usedAt: secondsAgo(2), revokedAt: secondsAgo(1) }),
        NOW,
      ),
    ).toEqual({ revokeFamily: true, clearCookies: true });
  });

  it('revokes the family when the token was used more than 10 s ago', () => {
    expect(judgeRefusedRefresh(state({ usedAt: secondsAgo(11) }), NOW)).toEqual(
      { revokeFamily: true, clearCookies: true },
    );
  });

  it('forgives a reuse of exactly 10 s: nothing revoked, cookies untouched', () => {
    expect(judgeRefusedRefresh(state({ usedAt: secondsAgo(10) }), NOW)).toEqual(
      { revokeFamily: false, clearCookies: false },
    );
  });

  it('forgives a reuse of 1 s and revokes at 10.001 s', () => {
    expect(judgeRefusedRefresh(state({ usedAt: secondsAgo(1) }), NOW)).toEqual({
      revokeFamily: false,
      clearCookies: false,
    });
    expect(
      judgeRefusedRefresh(
        state({ usedAt: new Date(NOW.getTime() - 10_001) }),
        NOW,
      ),
    ).toEqual({ revokeFamily: true, clearCookies: true });
  });
});
