import { InvalidInput } from '../../shared/domain/errors';
import { PageLimit } from './page-limit';

describe('PageLimit', () => {
  it.each([
    ['1', 1],
    ['5', 5],
    ['50', 50],
    [undefined, 5],
  ])('parse(%j) gives %i', (raw, expected) => {
    expect(PageLimit.parse(raw).value).toBe(expected);
  });

  it.each(['abc', '2.5', '-1', '0', '51', '', ' 2', ['1', '2'], 3, null])(
    'rejects %j',
    (raw) => {
      expect(() => PageLimit.parse(raw)).toThrow(InvalidInput);
    },
  );

  it('does not echo the input in the message', () => {
    let message = '';
    try {
      PageLimit.parse('<script>');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('limit must be an integer between 1 and 50');
    expect(message).not.toContain('script');
  });
});
