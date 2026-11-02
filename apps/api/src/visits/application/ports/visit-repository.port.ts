import type { VisitEvent } from '../../domain/visit-event';
import type { VisitKind } from '../../domain/visit-kind';

/** A visit as the admin sees it: the recruiter's current company and name. */
export interface VisitRow {
  id: string;
  kind: VisitKind;
  occurredAt: Date;
  company: string | null;
  name: string | null;
}

export interface VisitRepository {
  /**
   * Stores the event and, in the same operation, purges at most PURGE_BATCH events
   * older than `retainFrom` (the exact boundary is kept).
   */
  append(event: VisitEvent, retainFrom: Date): Promise<void>;
}

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');
