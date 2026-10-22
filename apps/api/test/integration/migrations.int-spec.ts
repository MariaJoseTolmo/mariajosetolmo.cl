import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

describe('migrations (real Postgres)', () => {
  let db: IsolatedDatabase;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
  });
  afterAll(() => db.close());

  const tables = async (): Promise<string[]> => {
    const rows = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name <> 'migrations' ORDER BY 1`,
      [db.schema],
    );
    return rows.map((row) => String(row['table_name']));
  };

  it('goes up, down and up again', async () => {
    await db.dataSource.runMigrations();
    expect(await tables()).toEqual(['users']);

    await db.dataSource.undoLastMigration();
    expect(await tables()).toEqual([]);

    await db.dataSource.runMigrations();
    expect(await tables()).toEqual(['users']);
  });

  it('is idempotent: running again applies nothing new', async () => {
    await db.dataSource.runMigrations();
    await expect(db.dataSource.runMigrations()).resolves.toEqual([]);
  });

  describe('users', () => {
    beforeAll(async () => {
      await db.dataSource.runMigrations();
    });

    const insert = (
      email: string,
      role = 'RECRUITER',
      company: string | null = null,
    ): Promise<unknown> =>
      db.query('INSERT INTO users (email, role, company) VALUES ($1, $2, $3)', [
        email,
        role,
        company,
      ]);

    it('fills id, role, and timestamps by default', async () => {
      const [row] = await db.query(
        `INSERT INTO users (email) VALUES ('defaults@example.test')
         RETURNING id, role, created_at, last_login_at`,
      );
      expect(row?.['id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(row?.['role']).toBe('RECRUITER');
      expect(row?.['created_at']).toBeInstanceOf(Date);
      expect(row?.['last_login_at']).toBeNull();
    });

    it('keeps email unique', async () => {
      await insert('dup@example.test');
      await expect(insert('dup@example.test')).rejects.toThrow(
        /unique|duplicate/i,
      );
    });

    it('refuses an email that is not lower case', async () => {
      await expect(insert('Upper@Example.test')).rejects.toThrow(/check/i);
    });

    it('refuses a role outside RECRUITER and ADMIN, and accepts both', async () => {
      await expect(insert('r1@example.test', 'OWNER')).rejects.toThrow(
        /check/i,
      );
      await insert('r2@example.test', 'ADMIN');
      await insert('r3@example.test', 'RECRUITER');
    });

    it('bounds company and name to 120 characters', async () => {
      await insert('c1@example.test', 'RECRUITER', 'x'.repeat(120));
      await expect(
        insert('c2@example.test', 'RECRUITER', 'x'.repeat(121)),
      ).rejects.toThrow(/check/i);
      await expect(
        db.query('INSERT INTO users (email, name) VALUES ($1, $2)', [
          'c3@example.test',
          'x'.repeat(121),
        ]),
      ).rejects.toThrow(/check/i);
    });

    it('documents the table and its non-obvious columns', async () => {
      const rows = await db.query(
        `SELECT a.attname AS column_name, d.description
         FROM pg_description d
         JOIN pg_class c ON c.oid = d.objoid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid AND d.objsubid > 0
         WHERE c.relname = 'users' AND n.nspname = $1`,
        [db.schema],
      );
      const documented = rows.map((r) => r['column_name'] ?? '(table)');
      expect(documented).toEqual(
        expect.arrayContaining(['(table)', 'email', 'role', 'last_login_at']),
      );
    });
  });
});
