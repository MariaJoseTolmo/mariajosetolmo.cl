import type { SkillLevel } from './skill-level';

export interface SkillGroup {
  readonly level: SkillLevel;
  readonly skills: readonly string[];
}
