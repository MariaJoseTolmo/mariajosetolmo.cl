import { InvalidInput } from '../../shared/domain/errors';
import { ExperienceCursor } from './experience-cursor';

describe('ExperienceCursor', () => {
  it.each([
    ['0', 0],
    ['3', 3],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    [undefined, 0],
  ])('parse(%j) gives %i', (raw, expected) => {
    expect(ExperienceCursor.parse(raw).value).toBe(expected);
  });

  it.each([
    'abc',
    '-1',
    '',
    '1.5',
    '<script>',
    String(Number.MAX_SAFE_INTEGER + 2),
    '99999999999999999999',
    ['1', '2'],
    4,
    null,
  ])('rejects %j', (raw) => {
    expect(() => ExperienceCursor.parse(raw)).toThrow(InvalidInput);
  });

  it('does not echo the input in the message', () => {
    let message = '';
    try {
      ExperienceCursor.parse('<script>');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('cursor must be a non-negative integer');
    expect(message).not.toContain('script');
  });
});
