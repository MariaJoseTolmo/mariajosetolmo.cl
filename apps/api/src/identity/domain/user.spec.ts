import { InvalidInput } from '../../shared/domain/errors';
import { optionalProfileText } from './user';

describe('optionalProfileText', () => {
  it('trims surrounding whitespace', () => {
    expect(optionalProfileText('  Acme Corp ', 'company')).toBe('Acme Corp');
  });

  it.each([undefined, null, '', '   ', '\t\n'])(
    'treats %j as absent',
    (raw) => {
      expect(optionalProfileText(raw, 'name')).toBeNull();
    },
  );

  it('accepts exactly 120 characters and rejects 121', () => {
    expect(optionalProfileText('x'.repeat(120), 'company')).toHaveLength(120);
    expect(() => optionalProfileText('x'.repeat(121), 'company')).toThrow(
      InvalidInput,
    );
  });

  it('counts the length after trimming', () => {
    expect(optionalProfileText(` ${'x'.repeat(120)} `, 'name')).toHaveLength(
      120,
    );
  });

  it('rejects control characters and names the field', () => {
    expect(() => optionalProfileText('Ana\u0007', 'name')).toThrow(
      InvalidInput,
    );
    expect(() => optionalProfileText('Ac\nme', 'company')).toThrow(/company/);
  });

  it('rejects non-string values', () => {
    expect(() => optionalProfileText(42, 'name')).toThrow(InvalidInput);
  });

  it('keeps accents and non-Latin characters', () => {
    expect(optionalProfileText('María José', 'name')).toBe('María José');
  });
});
