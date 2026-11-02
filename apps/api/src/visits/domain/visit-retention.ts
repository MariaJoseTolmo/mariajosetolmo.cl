export const RETENTION_DAYS = 180;

/** Most events one write purges, so a write stays short after a quiet period. */
export const PURGE_BATCH = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Oldest instant that is still kept: events strictly older are purged, so an
 * event exactly RETENTION_DAYS old stays.
 */
export function retainFrom(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}
