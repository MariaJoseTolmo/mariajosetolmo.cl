const SECONDS_PER_DAY = 24 * 60 * 60;
const MILLIS = 1000;

/** Session durations are domain rules, not configuration (design 5). */
export const SessionPolicy = {
  MAGIC_LINK_TTL_SECONDS: 15 * 60,
  ACCESS_TTL_SECONDS: 15 * 60,
  /** Absolute: rotation never extends it (design A8). */
  SESSION_TTL_SECONDS: 7 * SECONDS_PER_DAY,
  /** A refresh token used this recently is a racing tab, not theft (A9). */
  REUSE_GRACE_SECONDS: 10,

  sessionExpiresAt(loginAt: Date): Date {
    return new Date(
      loginAt.getTime() + SessionPolicy.SESSION_TTL_SECONDS * MILLIS,
    );
  },

  /** Remaining family time in whole seconds, never negative. */
  refreshCookieMaxAge(expiresAt: Date, now: Date): number {
    return Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / MILLIS),
    );
  },

  isWithinReuseGrace(usedAt: Date, now: Date): boolean {
    return (
      now.getTime() - usedAt.getTime() <=
      SessionPolicy.REUSE_GRACE_SECONDS * MILLIS
    );
  },

  isSessionExpired(expiresAt: Date, now: Date): boolean {
    return now.getTime() >= expiresAt.getTime();
  },
} as const;
