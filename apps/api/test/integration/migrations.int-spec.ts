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
    expect(await tables()).toEqual(['availability', 'refresh_tokens', 'users']);

    // Each `down` undoes only its own migration, newest first.
    await db.dataSource.undoLastMigration();
    expect(await tables()).toEqual(['refresh_tokens', 'users']);
    await db.dataSource.undoLastMigration();
    expect(await tables()).toEqual(['users']);
    await db.dataSource.undoLastMigration();
    expect(await tables()).toEqual([]);

    await db.dataSource.runMigrations();
    expect(await tables()).toEqual(['availability', 'refresh_tokens', 'users']);
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
  describe('refresh_tokens', () => {
    let userId: string;
    beforeAll(async () => {
      await db.dataSource.runMigrations();
      const [user] = await db.query(
        `INSERT INTO users (email) VALUES ('rt-owner@example.test') RETURNING id`,
      );
      userId = String(user?.['id']);
    });

    const insert = (
      tokenHash: string,
      owner: string = userId,
      expires = '2026-03-08T10:00:00Z',
    ): Promise<unknown> =>
      db.query(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
         VALUES ($1, gen_random_uuid(), decode($2, 'hex'), $3)`,
        [owner, tokenHash, expires],
      );

    it('fills id, created_at and leaves used_at and revoked_at empty', async () => {
      await insert('a'.repeat(64));
      const [row] = await db.query(
        `SELECT id, created_at, used_at, revoked_at FROM refresh_tokens
         WHERE token_hash = decode($1, 'hex')`,
        ['a'.repeat(64)],
      );
      expect(row?.['id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(row?.['created_at']).toBeInstanceOf(Date);
      expect([row?.['used_at'], row?.['revoked_at']]).toEqual([null, null]);
    });

    it('keeps the hash unique', async () => {
      await insert('b'.repeat(64));
      await expect(insert('b'.repeat(64))).rejects.toThrow(/unique|duplicate/i);
    });

    it('accepts only 32-byte hashes', async () => {
      await expect(insert('c'.repeat(62))).rejects.toThrow(/check/i);
      await expect(insert('c'.repeat(66))).rejects.toThrow(/check/i);
    });

    it('requires an existing user, and follows the user when deleted', async () => {
      await expect(
        insert('d'.repeat(64), 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
      ).rejects.toThrow(/foreign key/i);
      const [other] = await db.query(
        `INSERT INTO users (email) VALUES ('rt-gone@example.test') RETURNING id`,
      );
      await insert('e'.repeat(64), String(other?.['id']));
      const count = async (): Promise<number> =>
        (
          await db.query(
            `SELECT 1 FROM refresh_tokens WHERE token_hash = decode($1, 'hex')`,
            ['e'.repeat(64)],
          )
        ).length;
      expect(await count()).toBe(1);
      await db.query('DELETE FROM users WHERE id = $1', [other?.['id']]);
      expect(await count()).toBe(0);
    });

    it('indexes the family and the hash', async () => {
      const rows = await db.query(
        `SELECT indexdef FROM pg_indexes
         WHERE schemaname = $1 AND tablename = 'refresh_tokens'`,
        [db.schema],
      );
      const defs = rows.map((r) => String(r['indexdef']));
      expect(defs.some((d) => /UNIQUE.*\(token_hash\)/.test(d))).toBe(true);
      expect(defs.some((d) => /\(family_id\)/.test(d))).toBe(true);
      expect(defs.some((d) => /\(user_id\)/.test(d))).toBe(true);
    });

    it('documents the table and its non-obvious columns', async () => {
      const rows = await db.query(
        `SELECT a.attname AS column_name, d.description
         FROM pg_description d
         JOIN pg_class c ON c.oid = d.objoid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid AND d.objsubid > 0
         WHERE c.relname = 'refresh_tokens' AND n.nspname = $1`,
        [db.schema],
      );
      const documented = rows.map((r) => r['column_name'] ?? '(table)');
      expect(documented).toEqual(
        expect.arrayContaining([
          '(table)',
          'family_id',
          'token_hash',
          'used_at',
          'expires_at',
        ]),
      );
    });
  });
});
