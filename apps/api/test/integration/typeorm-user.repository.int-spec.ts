import { databaseUrl } from './support/env';
import { Email } from '../../src/identity/domain/email';
import { TypeOrmUserRepository } from '../../src/identity/infrastructure/persistence/typeorm-user.repository';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { createDataSource } from '../../src/shared/infrastructure/persistence/data-source.factory';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const LATER = new Date('2026-03-02T10:00:00.000Z');

describe('TypeOrmUserRepository (real Postgres)', () => {
  let db: IsolatedDatabase;
  let repo: TypeOrmUserRepository;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    repo = new TypeOrmUserRepository(db.dataSource);
  });
  afterAll(() => db.close());

  const login = (
    email: string,
    extra: {
      role?: 'RECRUITER' | 'ADMIN';
      company?: string | null;
      name?: string | null;
    } = {},
  ): Parameters<TypeOrmUserRepository['upsertOnLogin']>[0] => ({
    email: Email.parse(email),
    role: extra.role ?? 'RECRUITER',
    company: extra.company ?? null,
    name: extra.name ?? null,
  });

  it('inserts a new user and returns what was stored', async () => {
    const user = await repo.upsertOnLogin(
      login('new@example.test', { company: 'Acme', name: 'Ana' }),
      NOW,
    );
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user).toMatchObject({
      role: 'RECRUITER',
      company: 'Acme',
      name: 'Ana',
    });
    expect(user.email.value).toBe('new@example.test');
    const [row] = await db.query(
      'SELECT last_login_at FROM users WHERE id = $1',
      [user.id],
    );
    expect(row?.['last_login_at']).toEqual(NOW);
  });

  it('keeps id, company and name when a later login brings none (COALESCE)', async () => {
    const first = await repo.upsertOnLogin(
      login('keep@example.test', { company: 'Acme', name: 'Ana' }),
      NOW,
    );
    const second = await repo.upsertOnLogin(login('keep@example.test'), LATER);
    expect(second).toMatchObject({
      id: first.id,
      company: 'Acme',
      name: 'Ana',
    });
    const [row] = await db.query(
      'SELECT last_login_at, created_at FROM users WHERE id = $1',
      [first.id],
    );
    expect(row?.['last_login_at']).toEqual(LATER);
  });

  it('replaces company and name when the login brings new ones', async () => {
    await repo.upsertOnLogin(
      login('swap@example.test', { company: 'Acme' }),
      NOW,
    );
    const updated = await repo.upsertOnLogin(
      login('swap@example.test', { company: 'Otra', name: 'Bea' }),
      LATER,
    );
    expect(updated).toMatchObject({ company: 'Otra', name: 'Bea' });
  });

  it('overwrites the role on every login, promotion and demotion', async () => {
    await repo.upsertOnLogin(
      login('role@example.test', { role: 'ADMIN' }),
      NOW,
    );
    expect(
      (await repo.upsertOnLogin(login('role@example.test'), LATER)).role,
    ).toBe('RECRUITER');
    expect(
      (
        await repo.upsertOnLogin(
          login('role@example.test', { role: 'ADMIN' }),
          LATER,
        )
      ).role,
    ).toBe('ADMIN');
  });

  it('survives many simultaneous logins of one new email with a single row', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        repo.upsertOnLogin(login('race@example.test'), NOW),
      ),
    );
    expect(new Set(results.map((user) => user.id)).size).toBe(1);
    const rows = await db.query(
      `SELECT count(*)::int AS n FROM users WHERE email = 'race@example.test'`,
    );
    expect(rows[0]?.['n']).toBe(1);
  });

  it('finds a user by id, and null for an unknown or malformed id', async () => {
    const user = await repo.upsertOnLogin(login('find@example.test'), NOW);
    await expect(repo.findById(user.id)).resolves.toEqual(user);
    await expect(
      repo.findById('ffffffff-ffff-4fff-8fff-ffffffffffff'),
    ).resolves.toBeNull();
    await expect(repo.findById('user-1')).resolves.toBeNull();
  });

  it('fails closed with InfrastructureUnavailable when the database is down', async () => {
    const down = createDataSource('postgres://x:y@127.0.0.1:1/none');
    const broken = new TypeOrmUserRepository(down);
    await expect(
      broken.upsertOnLogin(login('a@example.test'), NOW),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
    await expect(
      broken.findById('ffffffff-ffff-4fff-8fff-ffffffffffff'),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });

  it('opens an unopened DataSource on first use', async () => {
    const lazy = createDataSource(databaseUrl(), {
      options: `-c search_path=${db.schema}`,
    });
    try {
      expect(lazy.isInitialized).toBe(false);
      const user = await new TypeOrmUserRepository(lazy).upsertOnLogin(
        login('lazy@example.test'),
        NOW,
      );
      expect(user.email.value).toBe('lazy@example.test');
      expect(lazy.isInitialized).toBe(true);
    } finally {
      if (lazy.isInitialized) await lazy.destroy();
    }
  });

  it('answers 503-class errors while down and works once the database is back', async () => {
    const flaky = createDataSource(databaseUrl(), {
      options: `-c search_path=${db.schema}`,
    });
    const initialize = jest
      .spyOn(flaky, 'initialize')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    try {
      const flakyRepo = new TypeOrmUserRepository(flaky);
      await expect(
        flakyRepo.findById('ffffffff-ffff-4fff-8fff-ffffffffffff'),
      ).rejects.toBeInstanceOf(InfrastructureUnavailable);
      initialize.mockRestore();
      await expect(
        flakyRepo.findById('ffffffff-ffff-4fff-8fff-ffffffffffff'),
      ).resolves.toBeNull();
    } finally {
      if (flaky.isInitialized) await flaky.destroy();
    }
  });
});
