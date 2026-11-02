import { InvalidInput } from '../../shared/domain/errors';
import { VISIT_KINDS, parseKindFilter } from './visit-kind';

describe('VisitKind', () => {
  it('lists the two kinds in a fixed order', () => {
    expect([...VISIT_KINDS]).toEqual(['LOGIN', 'CV_LINK']);
  });

  it('parseKindFilter(undefined) means all kinds (null)', () => {
    expect(parseKindFilter(undefined)).toBeNull();
  });

  it.each(['LOGIN', 'CV_LINK'])('parseKindFilter(%j) accepts it', (raw) => {
    expect(parseKindFilter(raw)).toBe(raw);
  });

  it.each([
    ['an array', ['LOGIN', 'CV_LINK']],
    ['an empty string', ''],
    ['lower case', 'login'],
    ['an unknown kind', 'OTHER'],
    ['null', null],
    ['a number', 1],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseKindFilter(raw)).toThrow(InvalidInput);
  });

  it('does not echo the input in the message', () => {
    let message = '';
    try {
      parseKindFilter('OTHER');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('kind is not a known visit kind');
    expect(message).not.toContain('OTHER');
  });
});
