import { InfrastructureUnavailable } from '../../../shared/domain/errors';
import type { ContentRepository } from '../../application/ports/content-repository.port';
import type { ExperienceEntry } from '../../domain/experience-entry';
import type { Profile } from '../../domain/profile';
import type { SkillGroup } from '../../domain/skill-group';
import { SKILL_LEVELS, type SkillLevel } from '../../domain/skill-level';

export interface ContentSeed {
  readonly profile?: Profile;
  readonly experience?: readonly ExperienceEntry[];
  readonly skills?: readonly SkillGroup[];
}

/** Seedable stand-in; empty by default (no profile, no entries, no skills). */
export class InMemoryContentRepository implements ContentRepository {
  constructor(private seed: ContentSeed = {}) {}

  set(seed: ContentSeed): void {
    this.seed = seed;
  }

  getProfile(): Promise<Profile> {
    const { profile } = this.seed;
    if (!profile) return Promise.reject(new InfrastructureUnavailable());
    return Promise.resolve(profile);
  }

  listExperience(after: number, limit: number): Promise<ExperienceEntry[]> {
    const rows = [...(this.seed.experience ?? [])]
      .filter((entry) => entry.position > after)
      .sort((a, b) => a.position - b.position)
      .slice(0, limit + 1);
    return Promise.resolve(rows);
  }

  listSkills(level: SkillLevel | null): Promise<SkillGroup[]> {
    const levels = level === null ? SKILL_LEVELS : [level];
    return Promise.resolve(
      levels.map((name) => ({
        level: name,
        skills: this.seed.skills?.find((g) => g.level === name)?.skills ?? [],
      })),
    );
  }
}
