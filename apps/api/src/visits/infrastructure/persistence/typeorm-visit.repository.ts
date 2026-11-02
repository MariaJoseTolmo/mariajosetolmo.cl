import type { DataSource } from 'typeorm';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import type {
  VisitPageQuery,
  VisitRepository,
  VisitRow,
} from '../../application/ports/visit-repository.port';
import type { VisitEvent } from '../../domain/visit-event';
import type { VisitKind } from '../../domain/visit-kind';
import { PURGE_BATCH } from '../../domain/visit-retention';

// ONE statement (no transaction, no session state: safe behind a pooler). The
// CTE purge and the INSERT commit or fail together; the purge reads a snapshot
// taken before the INSERT, so it never deletes the row being added. Normally it
// deletes nothing, and the (occurred_at DESC, id DESC) index serves it. The
// cap (PURGE_BATCH) keeps one write short after a long quiet period. SKIP
// LOCKED lets concurrent appends purge disjoint batches instead of waiting.
const APPEND = `
  WITH purged AS (
    DELETE FROM visit_events WHERE id IN (
      SELECT id FROM visit_events WHERE occurred_at < $5
      ORDER BY occurred_at, id LIMIT $6::int FOR UPDATE SKIP LOCKED))
  INSERT INTO visit_events (id, user_id, kind, occurred_at)
  VALUES ($1::uuid, $2::uuid, $3, $4)`;

// Keyset on (occurred_at DESC, id DESC), served by visit_events_occurred_at_id_idx.
// The first page has no position, so it compares against a sentinel that sorts
// after every real row. The JOIN gives the recruiter's current profile and drops
// events whose user is gone. Static text, no branches: filters are parameters.
const FIRST_PAGE = {
  occurredAt: 'infinity',
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
} as const;

const LIST_PAGE = `
  SELECT e.id, e.kind, e.occurred_at, u.company, u.name
  FROM visit_events e JOIN users u ON u.id = e.user_id
  WHERE e.occurred_at >= $1 AND e.kind = ANY($2::text[])
    AND (e.occurred_at, e.id) < ($3::timestamptz, $4::uuid)
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT $5::int`;

interface VisitDbRow {
  id: string;
  kind: VisitKind;
  occurred_at: Date | string;
  company: string | null;
  name: string | null;
}

export class TypeOrmVisitRepository implements VisitRepository {
  constructor(private readonly dataSource: DataSource) {}

  async append(event: VisitEvent, retainFrom: Date): Promise<void> {
    await withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      await this.dataSource.query(APPEND, [
        event.id,
        event.userId,
        event.kind,
        event.occurredAt,
        retainFrom,
        PURGE_BATCH,
      ]);
    });
  }

  async listPage(query: VisitPageQuery): Promise<VisitRow[]> {
    const before = query.before ?? FIRST_PAGE;
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      const rows = await this.dataSource.query<VisitDbRow[]>(LIST_PAGE, [
        query.retainFrom,
        [...query.kinds],
        before.occurredAt,
        before.id,
        query.limit,
      ]);
      return rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        // pg already gives a Date for timestamptz; new Date() keeps the
        // contract if a driver or setting ever returns the ISO text instead.
        occurredAt: new Date(row.occurred_at),
        company: row.company,
        name: row.name,
      }));
    });
  }
}
