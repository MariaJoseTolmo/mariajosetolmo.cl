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

  /**
   * One keyset page, newest first by (occurredAt, id) both descending. Returns at
   * most `limit` rows (the caller asks for the page size plus one to know if
   * there is a next page). Only events at or after `retainFrom` of the given
   * `kinds` are listed, strictly before `before` when given (`null` is the first
   * page). Events whose user no longer exists are left out.
   */
  listPage(query: VisitPageQuery): Promise<VisitRow[]>;
}

export interface VisitPageQuery {
  readonly retainFrom: Date;
  readonly kinds: readonly VisitKind[];
  readonly before: { readonly occurredAt: Date; readonly id: string } | null;
  readonly limit: number;
}

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');
