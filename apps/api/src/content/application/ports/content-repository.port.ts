import type { ExperienceEntry } from '../../domain/experience-entry';
import type { Profile } from '../../domain/profile';
import type { SkillGroup } from '../../domain/skill-group';
import type { SkillLevel } from '../../domain/skill-level';

export interface ContentRepository {
  /** Rejects when there is no profile row. */
  getProfile(): Promise<Profile>;
  /** Entries with `position > after` in order, up to `limit + 1` of them. */
  listExperience(after: number, limit: number): Promise<ExperienceEntry[]>;
  /** One group for a level, or the four levels in `SKILL_LEVELS` order. */
  listSkills(level: SkillLevel | null): Promise<SkillGroup[]>;
}

export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');
