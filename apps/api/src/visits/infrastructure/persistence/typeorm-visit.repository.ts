import type { DataSource } from 'typeorm';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import type { VisitRepository } from '../../application/ports/visit-repository.port';
import type { VisitEvent } from '../../domain/visit-event';
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
}
