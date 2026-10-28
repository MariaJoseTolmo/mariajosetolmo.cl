import { InvalidInput } from '../../shared/domain/errors';
import { SKILL_LEVELS, SkillLevel } from './skill-level';

describe('SkillLevel', () => {
  it('lists the four levels in a fixed order', () => {
    expect([...SKILL_LEVELS]).toEqual([
      'advanced',
      'production',
      'architecture',
      'learning',
    ]);
  });

  it.each(['advanced', 'production', 'architecture', 'learning'])(
    'parse(%j) accepts it',
    (raw) => {
      expect(SkillLevel.parse(raw)).toBe(raw);
    },
  );

  it('parse(undefined) means all levels (null)', () => {
    expect(SkillLevel.parse(undefined)).toBeNull();
  });

  it.each(['expert', '', 'ADVANCED', ['advanced', 'learning'], 1, null])(
    'rejects %j',
    (raw) => {
      expect(() => SkillLevel.parse(raw)).toThrow(InvalidInput);
    },
  );

  it('does not echo the input in the message', () => {
    let message = '';
    try {
      SkillLevel.parse('expert');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('level is not a known skill level');
    expect(message).not.toContain('expert');
  });
});
