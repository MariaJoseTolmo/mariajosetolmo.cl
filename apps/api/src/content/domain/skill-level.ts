import { InvalidInput } from '../../shared/domain/errors';

/** Fixed order: it is also the order of the grouped response. */
export const SKILL_LEVELS = [
  'advanced',
  'production',
  'architecture',
  'learning',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SkillLevel = {
  /** `undefined` means "all levels" and gives `null`. */
  parse(raw: unknown): SkillLevel | null {
    if (raw === undefined) return null;
    const level = SKILL_LEVELS.find((candidate) => candidate === raw);
    if (level === undefined) {
      throw new InvalidInput('level is not a known skill level');
    }
    return level;
  },
};
