import type {
  VisitPageQuery,
  VisitRepository,
  VisitRow,
} from '../../application/ports/visit-repository.port';
import type { VisitEvent } from '../../domain/visit-event';
import { PURGE_BATCH } from '../../domain/visit-retention';

/** The recruiter's current profile, or `null` when the user is gone. */
export type UserLookup = (
  userId: string,
) => { company: string | null; name: string | null } | null;

export class InMemoryVisitRepository implements VisitRepository {
  private events: VisitEvent[] = [];

  /** Without a lookup every event belongs to a user with no company or name. */
  constructor(
    private readonly lookup: UserLookup = () => ({
      company: null,
      name: null,
    }),
  ) {}

  /** Mirrors the SQL: keyset on (occurredAt, id) descending, JOIN on users. */
  listPage(query: VisitPageQuery): Promise<VisitRow[]> {
    const { retainFrom, kinds, before, limit } = query;
    const rows: VisitRow[] = [];
    const newestFirst = [...this.events].sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime() ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
    for (const e of newestFirst) {
      if (rows.length >= limit) break;
      if (e.occurredAt < retainFrom || !kinds.includes(e.kind)) continue;
      if (before !== null && !isBefore(e, before)) continue;
      const profile = this.lookup(e.userId);
      if (profile === null) continue; // the user is gone: the SQL join drops it
      rows.push({
        id: e.id,
        kind: e.kind,
        occurredAt: new Date(e.occurredAt),
        company: profile.company,
        name: profile.name,
      });
    }
    return Promise.resolve(rows);
  }

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

function isBefore(
  event: VisitEvent,
  position: { occurredAt: Date; id: string },
): boolean {
  const delta = event.occurredAt.getTime() - position.occurredAt.getTime();
  return delta < 0 || (delta === 0 && event.id < position.id);
}
