import type { DataSource } from 'typeorm';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import type { ContentRepository } from '../../application/ports/content-repository.port';
import type { ExperienceEntry } from '../../domain/experience-entry';
import type { Profile } from '../../domain/profile';
import type { SkillGroup } from '../../domain/skill-group';
import { SKILL_LEVELS, type SkillLevel } from '../../domain/skill-level';

interface ProfileRow {
  name: string;
  role: string;
  architecture: string;
  domains: string[];
  open_to_work: boolean;
}

interface ExperienceRow {
  id: string;
  position: number | string;
  company: string;
  role: string;
  sector: string;
  period_label: string;
  highlights: string[];
  technologies: string[];
}

interface SkillRow {
  level: string;
  name: string;
}

const SELECT_PROFILE = `SELECT name, role, architecture, domains, open_to_work FROM profile WHERE id = 1`;

// The casts are required: without them `pg` types `$1` as smallint (the
// column type) and a large cursor would fail with a range error (503)
// instead of returning an empty page.
const SELECT_EXPERIENCE = `
  SELECT id, position, company, role, sector, period_label, highlights, technologies
  FROM experience
  WHERE position > $1::bigint
  ORDER BY position
  LIMIT $2::int`;

const SELECT_SKILLS = `SELECT level, name FROM skill ORDER BY level, position`;
const SELECT_SKILLS_BY_LEVEL = `SELECT level, name FROM skill WHERE level = $1 ORDER BY position`;

export class TypeOrmContentRepository implements ContentRepository {
  constructor(private readonly dataSource: DataSource) {}

  getProfile(): Promise<Profile> {
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      const rows = await this.dataSource.query<ProfileRow[]>(SELECT_PROFILE);
      const row = rows[0];
      // The migration seeds the row and a CHECK keeps it single. If someone
      // deleted it, fail closed rather than serve an invented profile.
      if (!row) throw new MissingProfile();
      return {
        name: row.name,
        role: row.role,
        architecture: row.architecture,
        domains: row.domains,
        openToWork: row.open_to_work,
      };
    });
  }

  listExperience(after: number, limit: number): Promise<ExperienceEntry[]> {
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      const rows = await this.dataSource.query<ExperienceRow[]>(
        SELECT_EXPERIENCE,
        [after, limit + 1],
      );
      return rows.map((row) => ({
        id: row.id,
        position: Number(row.position),
        company: row.company,
        role: row.role,
        sector: row.sector,
        period: row.period_label,
        highlights: row.highlights,
        technologies: row.technologies,
      }));
    });
  }

  listSkills(level: SkillLevel | null): Promise<SkillGroup[]> {
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      const rows =
        level === null
          ? await this.dataSource.query<SkillRow[]>(SELECT_SKILLS)
          : await this.dataSource.query<SkillRow[]>(SELECT_SKILLS_BY_LEVEL, [
              level,
            ]);
      const levels = level === null ? SKILL_LEVELS : [level];
      return levels.map((name) => ({
        level: name,
        skills: rows.filter((row) => row.level === name).map((r) => r.name),
      }));
    });
  }
}

class MissingProfile extends Error {
  constructor() {
    super('profile row (id = 1) is missing');
  }
}
