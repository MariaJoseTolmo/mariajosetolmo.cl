import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { experience } from '../../../web/src/content/experience';
import { stack } from '../../../web/src/content/stack';
import { SKILL_LEVELS } from '../../src/content/domain/skill-level';
import { TypeOrmContentRepository } from '../../src/content/infrastructure/persistence/typeorm-content.repository';
import {
  contentViolations,
  findContentDrift,
  stripSqlPlaceholders,
  type ServedContent,
} from '../support/content-rules';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

const MIGRATION_SOURCE = join(
  __dirname,
  '../../src/shared/infrastructure/persistence/migrations/1792800000000-content.ts',
);

describe('content contract: seeded Postgres vs the web content', () => {
  let db: IsolatedDatabase;
  let served: ServedContent;
  let profileText: string;
  let profile: Awaited<ReturnType<TypeOrmContentRepository['getProfile']>>;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    const repo = new TypeOrmContentRepository(db.dataSource);
    profile = await repo.getProfile();
    profileText = JSON.stringify(profile);
    served = {
      experience: await repo.listExperience(0, 50),
      skills: await repo.listSkills(null),
    };
  });
  afterAll(() => db.close());

  describe('drift against apps/web/src/content', () => {
    it('serves exactly what experience.ts and stack.ts define', () => {
      expect(
        findContentDrift({ experience: experience.items, stack }, served),
      ).toEqual([]);
    });

    it('serves a non-empty experience and skills, matching the web counts', () => {
      expect(experience.items.length).toBeGreaterThan(0);
      expect(served.experience).toHaveLength(experience.items.length);
      for (const column of stack) {
        expect(column.items.length).toBeGreaterThan(0);
      }
      expect(served.skills.map((g) => g.skills.length)).toEqual(
        stack.map((column) => column.items.length),
      );
    });

    it('serves the same ids and employers in the same order', () => {
      expect(served.experience.map((e) => e.id)).toEqual(
        experience.items.map((i) => i.id),
      );
      expect(served.experience.map((e) => e.company)).toEqual(
        experience.items.map((i) => i.company),
      );
    });

    it('serves the four levels in fixed order with the same items', () => {
      expect(served.skills.map((g) => g.level)).toEqual([...SKILL_LEVELS]);
      expect(served.skills.map((g) => [...g.skills])).toEqual(
        stack.map((column) => column.items),
      );
    });
  });

  describe('forbidden content scan', () => {
    it('finds no salary, phone, availability, email or CV file in the served data', () => {
      const text = [
        profileText,
        JSON.stringify(served.experience),
        JSON.stringify(served.skills),
      ].join('\n');
      expect(contentViolations(text)).toEqual([]);
    });

    it('finds none in the migration source (SQL $n placeholders aside)', () => {
      // `$1`, `$2`... are query parameters, not money.
      const source = stripSqlPlaceholders(
        readFileSync(MIGRATION_SOURCE, 'utf8'),
      );
      expect(contentViolations(source)).toEqual([]);
    });

    it('keeps openToWork a boolean, never a date or text', () => {
      expect(typeof profile.openToWork).toBe('boolean');
    });

    it('allows employer names (allowed by decision)', () => {
      expect(served.experience.map((e) => e.company)).toContain(
        'Accenture Chile',
      );
      expect(contentViolations(JSON.stringify(served.experience))).toEqual([]);
    });
  });
});
