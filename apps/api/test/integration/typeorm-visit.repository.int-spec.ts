import { randomUUID } from 'node:crypto';
import { TypeOrmVisitRepository } from '../../src/visits/infrastructure/persistence/typeorm-visit.repository';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { createDataSource } from '../../src/shared/infrastructure/persistence/data-source.factory';
import type { VisitEvent } from '../../src/visits/domain/visit-event';
import { retainFrom } from '../../src/visits/domain/visit-retention';
import { databaseUrl } from './support/env';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-30T12:00:00.123Z');
const RETAIN_FROM = retainFrom(NOW);

describe('TypeOrmVisitRepository.append (real Postgres)', () => {
  let db: IsolatedDatabase;
  let repo: TypeOrmVisitRepository;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    repo = new TypeOrmVisitRepository(db.dataSource);
    const [user] = await db.query(
      `INSERT INTO users (email) VALUES ('owner@example.test') RETURNING id`,
    );
    userId = String(user?.['id']);
    const [other] = await db.query(
      `INSERT INTO users (email) VALUES ('other@example.test') RETURNING id`,
    );
    otherId = String(other?.['id']);
  });
  afterAll(() => db.close());
  beforeEach(() => db.query('DELETE FROM visit_events'));

  const event = (overrides: Partial<VisitEvent> = {}): VisitEvent => ({
    id: randomUUID(),
    userId,
    kind: 'LOGIN',
    occurredAt: NOW,
    ...overrides,
  });

  /** Puts rows straight in (no purge), `count` of them expired, oldest first. */
  const seedExpired = async (count: number): Promise<void> => {
    await db.query(
      `INSERT INTO visit_events (id, user_id, kind, occurred_at)
       SELECT gen_random_uuid(), $1, 'LOGIN', $2::timestamptz - (n * interval '1 minute')
       FROM generate_series(1, $3::int) AS n`,
      [userId, RETAIN_FROM, count],
    );
  };

  const stored = async (): Promise<{ id: string; at: string }[]> =>
    (
      await db.query(
        'SELECT id, occurred_at FROM visit_events ORDER BY occurred_at, id',
      )
    ).map((r) => ({
      id: String(r['id']),
      at: (r['occurred_at'] as Date).toISOString(),
    }));

  it('inserts the event with its id, user, kind and exact instant', async () => {
    const e = event({ kind: 'CV_LINK' });
    await repo.append(e, RETAIN_FROM);
    const [row] = await db.query(
      'SELECT id, user_id, kind, occurred_at FROM visit_events',
    );
    expect(row?.['id']).toBe(e.id);
    expect(row?.['user_id']).toBe(userId);
    expect(row?.['kind']).toBe('CV_LINK');
    expect((row?.['occurred_at'] as Date).toISOString()).toBe(
      '2026-06-30T12:00:00.123Z',
    );
  });

  it('purges at most 100 expired rows per write (105 -> 5 left + the new one)', async () => {
    await seedExpired(105);
    const fresh = event();
    await repo.append(fresh, RETAIN_FROM);
    const rows = await stored();
    expect(rows).toHaveLength(5 + 1);
    expect(rows.some((r) => r.id === fresh.id)).toBe(true);
    // The oldest go first, so the 5 survivors are the least old expired ones:
    // seedExpired put them 1..5 minutes before the cutoff.
    const expiredLeft = rows.filter((r) => r.id !== fresh.id).map((r) => r.at);
    expect(expiredLeft).toEqual(
      [5, 4, 3, 2, 1].map((minutes) =>
        new Date(RETAIN_FROM.getTime() - minutes * 60_000).toISOString(),
      ),
    );
    await repo.append(event(), RETAIN_FROM);
    expect(await stored()).toHaveLength(2);
  });

  it('keeps a row exactly 180 days old and purges one a millisecond older', async () => {
    const edge = event({ occurredAt: new Date(NOW.getTime() - 180 * DAY_MS) });
    const past = event({
      occurredAt: new Date(NOW.getTime() - 180 * DAY_MS - 1),
    });
    await db.query(
      `INSERT INTO visit_events (id, user_id, kind, occurred_at)
       VALUES ($1, $3, 'LOGIN', $2), ($4, $3, 'LOGIN', $5)`,
      [edge.id, edge.occurredAt, userId, past.id, past.occurredAt],
    );
    await repo.append(event(), RETAIN_FROM);
    const ids = (await stored()).map((r) => r.id);
    expect(ids).toContain(edge.id);
    expect(ids).not.toContain(past.id);
  });

  it('skips rows another transaction holds locked instead of waiting for them', async () => {
    await seedExpired(3);
    const holder = db.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    try {
      await holder.query(
        'SELECT id FROM visit_events WHERE occurred_at < $1 FOR UPDATE',
        [RETAIN_FROM],
      );
      const fresh = event();
      let timer: NodeJS.Timeout | undefined;
      const outcome = await Promise.race([
        repo.append(fresh, RETAIN_FROM).then(() => 'done'),
        new Promise<string>((resolve) => {
          timer = setTimeout(() => resolve('blocked'), 1500);
        }),
      ]);
      clearTimeout(timer);
      expect(outcome).toBe('done');
    } finally {
      await holder.rollbackTransaction();
      await holder.release();
    }
    // Nothing was purged (all three were locked) and the insert went in.
    expect(await stored()).toHaveLength(3 + 1);
  });

  it('does not purge the event it is adding, even if it is itself expired', async () => {
    const late = event({ occurredAt: new Date(RETAIN_FROM.getTime() - 1) });
    await repo.append(late, RETAIN_FROM);
    expect((await stored()).map((r) => r.id)).toEqual([late.id]);
  });

  it('leaves retained rows of every user alone', async () => {
    const mine = event();
    const theirs = event({ userId: otherId, kind: 'CV_LINK' });
    await repo.append(mine, RETAIN_FROM);
    await repo.append(theirs, RETAIN_FROM);
    expect((await stored()).map((r) => r.id).sort()).toEqual(
      [mine.id, theirs.id].sort(),
    );
  });

  it('runs a single statement (the purge and the insert are one CTE)', async () => {
    const spy = jest.spyOn(db.dataSource, 'query');
    try {
      await repo.append(event(), RETAIN_FROM);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/WITH purged AS/);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a kind outside the set, and stores nothing', async () => {
    const bad = { ...event(), kind: 'OTHER' } as unknown as VisitEvent;
    await expect(repo.append(bad, RETAIN_FROM)).rejects.toBeInstanceOf(
      InfrastructureUnavailable,
    );
    expect(await stored()).toEqual([]);
  });

  it('fails closed with InfrastructureUnavailable when the user does not exist', async () => {
    await expect(
      repo.append(event({ userId: randomUUID() }), RETAIN_FROM),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });

  it('fails closed with InfrastructureUnavailable when the database is down', async () => {
    const down = createDataSource('postgres://x:y@127.0.0.1:1/none');
    await expect(
      new TypeOrmVisitRepository(down).append(event(), RETAIN_FROM),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });

  it('opens an unopened DataSource on first use', async () => {
    const lazy = createDataSource(databaseUrl(), {
      options: `-c search_path=${db.schema}`,
    });
    try {
      expect(lazy.isInitialized).toBe(false);
      await new TypeOrmVisitRepository(lazy).append(event(), RETAIN_FROM);
      expect(lazy.isInitialized).toBe(true);
      expect(await stored()).toHaveLength(1);
    } finally {
      if (lazy.isInitialized) await lazy.destroy();
    }
  });
});
