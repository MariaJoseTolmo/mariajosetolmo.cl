import { SessionPolicy } from './session-policy';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const secondsAfter = (seconds: number): Date =>
  new Date(T0.getTime() + seconds * 1000);

describe('SessionPolicy', () => {
  it('exposes the fixed durations in seconds', () => {
    expect(SessionPolicy.MAGIC_LINK_TTL_SECONDS).toBe(900);
    expect(SessionPolicy.ACCESS_TTL_SECONDS).toBe(900);
    expect(SessionPolicy.SESSION_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(SessionPolicy.REUSE_GRACE_SECONDS).toBe(10);
  });

  describe('sessionExpiresAt', () => {
    it('is exactly 7 days after login', () => {
      expect(SessionPolicy.sessionExpiresAt(T0)).toEqual(
        new Date('2026-01-08T00:00:00.000Z'),
      );
    });

    it('does not mutate the input date', () => {
      SessionPolicy.sessionExpiresAt(T0);
      expect(T0.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('refreshCookieMaxAge', () => {
    it('is the full session length at login (604800 s)', () => {
      const expiresAt = SessionPolicy.sessionExpiresAt(T0);
      expect(SessionPolicy.refreshCookieMaxAge(expiresAt, T0)).toBe(604800);
    });

    it('is the remaining family time later in the session', () => {
      const expiresAt = SessionPolicy.sessionExpiresAt(T0);
      expect(
        SessionPolicy.refreshCookieMaxAge(expiresAt, secondsAfter(86400)),
      ).toBe(518400);
    });

    it('rounds down partial seconds and never goes negative', () => {
      expect(
        SessionPolicy.refreshCookieMaxAge(new Date(T0.getTime() + 1999), T0),
      ).toBe(1);
      expect(SessionPolicy.refreshCookieMaxAge(T0, secondsAfter(30))).toBe(0);
    });
  });

  describe('isWithinReuseGrace', () => {
    it('is true up to and including 10 s after use', () => {
      expect(SessionPolicy.isWithinReuseGrace(T0, secondsAfter(0))).toBe(true);
      expect(SessionPolicy.isWithinReuseGrace(T0, secondsAfter(10))).toBe(true);
    });

    it('is false once more than 10 s have passed', () => {
      expect(
        SessionPolicy.isWithinReuseGrace(T0, new Date(T0.getTime() + 10_001)),
      ).toBe(false);
      expect(SessionPolicy.isWithinReuseGrace(T0, secondsAfter(3600))).toBe(
        false,
      );
    });
  });

  describe('isSessionExpired', () => {
    it('is false before and true at or after expiry', () => {
      const expiresAt = SessionPolicy.sessionExpiresAt(T0);
      expect(SessionPolicy.isSessionExpired(expiresAt, secondsAfter(100))).toBe(
        false,
      );
      expect(SessionPolicy.isSessionExpired(expiresAt, expiresAt)).toBe(true);
    });
  });
});
