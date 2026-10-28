import { databaseUrl } from './support/env';
import { TypeOrmAvailabilityRepository } from '../../src/availability/infrastructure/persistence/typeorm-availability.repository';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { createDataSource } from '../../src/shared/infrastructure/persistence/data-source.factory';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

const PLACEHOLDER = '[dato de ejemplo]';

describe('TypeOrmAvailabilityRepository (real Postgres)', () => {
  let db: IsolatedDatabase;
  let repo: TypeOrmAvailabilityRepository;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    repo = new TypeOrmAvailabilityRepository(db.dataSource);
  });
  afterAll(() => db.close());

  async function isApplied(migrationName: string): Promise<boolean> {
    const rows = await db.query('SELECT name FROM migrations');
    return rows.some((r) => String(r['name']).startsWith(migrationName));
  }

  describe('seed', () => {
    it('ships placeholders only, in the single row', async () => {
      const rows = await db.query(
        'SELECT id, modality, start_label, salary FROM availability',
      );
      expect(rows).toEqual([
        {
          id: 1,
          modality: PLACEHOLDER,
          start_label: PLACEHOLDER,
          salary: PLACEHOLDER,
        },
      ]);
    });

    it('is not duplicated when the migration is applied again after a revert', async () => {
      // Revert newest-first until availability is gone, whatever sits on top.
      while (await isApplied('CreateAvailability')) {
        await db.dataSource.undoLastMigration();
      }
      expect(await isApplied('CreateAvailability')).toBe(false);
      await db.dataSource.runMigrations();
      expect(await isApplied('CreateAvailability')).toBe(true);
      const [count] = await db.query(
        'SELECT count(*)::int AS n FROM availability',
      );
      expect(count?.['n']).toBe(1);
    });
  });

  describe('table rules', () => {
    it('keeps exactly one row: a second id is refused', async () => {
      await expect(
        db.query(
          `INSERT INTO availability (id, modality, start_label, salary)
           VALUES (2, 'x', 'y', 'z')`,
        ),
      ).rejects.toThrow(/check/i);
    });

    it('refuses a second row with id 1 (primary key)', async () => {
      await expect(
        db.query(
          `INSERT INTO availability (id, modality, start_label, salary)
           VALUES (1, 'x', 'y', 'z')`,
        ),
      ).rejects.toThrow(/unique|duplicate/i);
    });

    it('requires the three labels', async () => {
      await expect(
        db.query('UPDATE availability SET salary = NULL WHERE id = 1'),
      ).rejects.toThrow(/null/i);
    });

    it('moves updated_at on an update made with the documented statement', async () => {
      const [before] = await db.query(
        'SELECT updated_at FROM availability WHERE id = 1',
      );
      await db.query(
        "UPDATE availability SET salary = $1, updated_at = now() + interval '1 second' WHERE id = 1",
        ['tmp'],
      );
      const [after] = await db.query(
        'SELECT updated_at FROM availability WHERE id = 1',
      );
      expect((after?.['updated_at'] as Date).getTime()).toBeGreaterThan(
        (before?.['updated_at'] as Date).getTime(),
      );
      await db.query('UPDATE availability SET salary = $1 WHERE id = 1', [
        PLACEHOLDER,
      ]);
    });

    it('documents the table and its columns', async () => {
      const rows = await db.query(
        `SELECT a.attname AS column_name, d.description
         FROM pg_description d
         JOIN pg_class c ON c.oid = d.objoid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid AND d.objsubid > 0
         WHERE c.relname = 'availability' AND n.nspname = $1`,
        [db.schema],
      );
      const documented = rows.map((r) => r['column_name'] ?? '(table)');
      expect(documented).toEqual(
        expect.arrayContaining([
          '(table)',
          'modality',
          'start_label',
          'salary',
        ]),
      );
    });
  });

  describe('get', () => {
    it('returns the seeded placeholders, mapping start_label to start', async () => {
      await expect(repo.get()).resolves.toEqual({
        modality: PLACEHOLDER,
        start: PLACEHOLDER,
        salary: PLACEHOLDER,
      });
    });

    it('returns what the owner loaded out of band, as plain text', async () => {
      await db.query(
        `UPDATE availability SET modality = 'remoto de ejemplo',
           start_label = 'inicio de ejemplo', salary = 'rango de ejemplo' WHERE id = 1`,
      );
      try {
        await expect(repo.get()).resolves.toEqual({
          modality: 'remoto de ejemplo',
          start: 'inicio de ejemplo',
          salary: 'rango de ejemplo',
        });
      } finally {
        await db.query(
          `UPDATE availability SET modality = $1, start_label = $1, salary = $1 WHERE id = 1`,
          [PLACEHOLDER],
        );
      }
    });

    it('fails closed (InfrastructureUnavailable) when the row is missing', async () => {
      await db.query('DELETE FROM availability');
      try {
        await expect(repo.get()).rejects.toBeInstanceOf(
          InfrastructureUnavailable,
        );
      } finally {
        await db.query(
          `INSERT INTO availability (id, modality, start_label, salary)
           VALUES (1, $1, $1, $1)`,
          [PLACEHOLDER],
        );
      }
    });

    it('fails closed with InfrastructureUnavailable when the database is down', async () => {
      const down = createDataSource('postgres://x:y@127.0.0.1:1/none');
      await expect(
        new TypeOrmAvailabilityRepository(down).get(),
      ).rejects.toBeInstanceOf(InfrastructureUnavailable);
    });

    it('opens an unopened DataSource on first use', async () => {
      const lazy = createDataSource(databaseUrl(), {
        options: `-c search_path=${db.schema}`,
      });
      try {
        expect(lazy.isInitialized).toBe(false);
        await expect(
          new TypeOrmAvailabilityRepository(lazy).get(),
        ).resolves.toEqual({
          modality: PLACEHOLDER,
          start: PLACEHOLDER,
          salary: PLACEHOLDER,
        });
        expect(lazy.isInitialized).toBe(true);
      } finally {
        if (lazy.isInitialized) await lazy.destroy();
      }
    });
  });
});
