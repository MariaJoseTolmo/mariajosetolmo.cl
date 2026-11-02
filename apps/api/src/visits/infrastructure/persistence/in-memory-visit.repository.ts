import type { VisitRepository } from '../../application/ports/visit-repository.port';
import type { VisitEvent } from '../../domain/visit-event';
import { PURGE_BATCH } from '../../domain/visit-retention';

export class InMemoryVisitRepository implements VisitRepository {
  private events: VisitEvent[] = [];

  append(event: VisitEvent, retainFrom: Date): Promise<void> {
    // Mirrors the SQL CTE: the purge looks at what was stored before this
    // write, oldest first, and never at the event being added.
    const doomed = new Set(
      this.events
        .filter((stored) => stored.occurredAt < retainFrom)
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .slice(0, PURGE_BATCH),
    );
    this.events = [
      ...this.events.filter((stored) => !doomed.has(stored)),
      { ...event },
    ];
    return Promise.resolve();
  }

  /** Test helper: puts an event without running the purge. */
  seed(event: VisitEvent): void {
    this.events = [...this.events, { ...event }];
  }

  /** Test helper: everything stored, in insertion order. */
  all(): readonly VisitEvent[] {
    return this.events;
  }
}
