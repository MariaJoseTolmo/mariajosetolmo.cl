import type { VisitEvent } from './visit-event';
import { PURGE_BATCH, RETENTION_DAYS, retainFrom } from './visit-retention';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-30T12:00:00.123Z');

const eventAged = (days: number): VisitEvent => ({
  id: `event-${days}`,
  userId: 'user-1',
  kind: 'LOGIN',
  occurredAt: new Date(NOW.getTime() - days * DAY_MS),
});

/** The retention rule: an event is purged when it is older than the cutoff. */
const isPurged = (event: VisitEvent, now: Date): boolean =>
  event.occurredAt < retainFrom(now);

describe('visit retention', () => {
  it('keeps 180 days', () => {
    expect(RETENTION_DAYS).toBe(180);
  });

  it('purges at most 100 events per write', () => {
    expect(PURGE_BATCH).toBe(100);
  });

  it('retainFrom(now) is exactly 180 days before now, to the millisecond', () => {
    expect(retainFrom(NOW).toISOString()).toBe('2026-01-01T12:00:00.123Z');
    const other = new Date('2027-03-05T00:00:00.000Z');
    expect(retainFrom(other).getTime()).toBe(other.getTime() - 180 * DAY_MS);
  });

  it('does not mutate its argument', () => {
    const now = new Date(NOW);
    retainFrom(now);
    expect(now.getTime()).toBe(NOW.getTime());
  });

  it.each([
    [179, false],
    [180, false],
    [181, true],
  ])('an event %i days old is purged: %s', (days, purged) => {
    expect(isPurged(eventAged(days), NOW)).toBe(purged);
  });
});
