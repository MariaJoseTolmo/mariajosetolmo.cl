import { databaseUrl } from './support/env';
import { TypeOrmContentRepository } from '../../src/content/infrastructure/persistence/typeorm-content.repository';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { createDataSource } from '../../src/shared/infrastructure/persistence/data-source.factory';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

describe('TypeOrmContentRepository (real Postgres)', () => {
  let db: IsolatedDatabase;
  let repo: TypeOrmContentRepository;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    repo = new TypeOrmContentRepository(db.dataSource);
  });
  afterAll(() => db.close());

  describe('getProfile', () => {
    it('returns the seeded profile with a boolean openToWork and string[] domains', async () => {
      const profile = await repo.getProfile();
      expect(Object.keys(profile).sort()).toEqual([
        'architecture',
        'domains',
        'name',
        'openToWork',
        'role',
      ]);
      expect(typeof profile.openToWork).toBe('boolean');
      expect(profile.domains).toEqual(['banca', 'minería']);
    });

    it('fails closed (InfrastructureUnavailable) when the row is missing', async () => {
      const saved = await db.query('SELECT * FROM profile');
      await db.query('DELETE FROM profile');
      try {
        await expect(repo.getProfile()).rejects.toBeInstanceOf(
          InfrastructureUnavailable,
        );
      } finally {
        const row = saved[0] as Record<string, unknown>;
        await db.query(
          `INSERT INTO profile (id, name, role, architecture, domains, open_to_work)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            row['id'],
            row['name'],
            row['role'],
            row['architecture'],
            row['domains'],
            row['open_to_work'],
          ],
        );
      }
    });
  });

  describe('listExperience', () => {
    it('returns entries ordered by position, mapped to the domain shape', async () => {
      const rows = await repo.listExperience(0, 50);
      expect(rows.map((r) => r.id)).toEqual([
        'kabeli',
        'amecs',
        'accenture',
        'independiente',
        'consultoria',
      ]);
      expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          company: 'Kabeli',
          period: '2026 · remoto',
        }),
      );
    });

    it('returns text[] columns as string[]', async () => {
      const [first] = await repo.listExperience(0, 1);
      expect(Array.isArray(first?.highlights)).toBe(true);
      expect(first?.highlights).toHaveLength(3);
      expect(first?.technologies).toEqual([
        'Claude Code',
        'Spec-Driven',
        'Node.js',
      ]);
      const rows = await repo.listExperience(3, 5);
      expect(rows[0]?.technologies).toEqual([]);
    });

    it('returns limit + 1 rows after the keyset position', async () => {
      const rows = await repo.listExperience(1, 2);
      expect(rows.map((r) => r.position)).toEqual([2, 3, 4]);
    });

    it('returns the remainder on the last page', async () => {
      const rows = await repo.listExperience(4, 2);
      expect(rows.map((r) => r.position)).toEqual([5]);
    });

    it('returns [] (not an error) for a cursor beyond smallint and beyond bigint safe range', async () => {
      await expect(repo.listExperience(100000, 5)).resolves.toEqual([]);
      await expect(
        repo.listExperience(Number.MAX_SAFE_INTEGER, 5),
      ).resolves.toEqual([]);
    });
  });

  describe('listSkills', () => {
    it('returns the four levels in fixed order, skills in position order', async () => {
      const groups = await repo.listSkills(null);
      expect(groups.map((g) => g.level)).toEqual([
        'advanced',
        'production',
        'architecture',
        'learning',
      ]);
      expect(groups[0]?.skills).toEqual([
        'JavaScript',
        'Node.js',
        'NestJS',
        'PostgreSQL',
      ]);
      expect(groups[3]?.skills).toHaveLength(3);
    });

    it('returns a single group for a level', async () => {
      const groups = await repo.listSkills('learning');
      expect(groups).toEqual([
        {
          level: 'learning',
          skills: [
            'AWS (Cloud Computing): aprendiendo, aplicado en este proyecto',
            'Java · Spring Boot',
            'Python',
          ],
        },
      ]);
    });

    it('returns an empty group for a level without skills', async () => {
      const removed = await db.query(
        `SELECT level, position, name FROM skill WHERE level = 'learning'`,
      );
      await db.query(`DELETE FROM skill WHERE level = 'learning'`);
      expect(removed).toHaveLength(3);
      try {
        await expect(repo.listSkills('learning')).resolves.toEqual([
          { level: 'learning', skills: [] },
        ]);
        const all = await repo.listSkills(null);
        expect(all.at(-1)).toEqual({ level: 'learning', skills: [] });
      } finally {
        for (const row of removed) {
          await db.query(
            'INSERT INTO skill (level, position, name) VALUES ($1, $2, $3)',
            [row['level'], row['position'], row['name']],
          );
        }
      }
    });
  });

  describe('availability of the database', () => {
    it('fails closed with InfrastructureUnavailable on every method when it is down', async () => {
      const down = createDataSource('postgres://x:y@127.0.0.1:1/none');
      const broken = new TypeOrmContentRepository(down);
      await expect(broken.getProfile()).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      await expect(broken.listExperience(0, 5)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      await expect(broken.listSkills(null)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
    });

    it('opens an unopened DataSource on first use', async () => {
      const lazy = createDataSource(databaseUrl(), {
        options: `-c search_path=${db.schema}`,
      });
      try {
        expect(lazy.isInitialized).toBe(false);
        const profile = await new TypeOrmContentRepository(lazy).getProfile();
        expect(profile.name).not.toBe('');
        expect(lazy.isInitialized).toBe(true);
      } finally {
        if (lazy.isInitialized) await lazy.destroy();
      }
    });
  });
});
