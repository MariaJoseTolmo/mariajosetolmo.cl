import { InvalidInput } from '../../shared/domain/errors';
import { Email } from './email';

describe('Email', () => {
  it('trims and lowercases', () => {
    expect(Email.parse('  Recruiter@Example.TEST ').value).toBe(
      'recruiter@example.test',
    );
  });

  it.each([
    'a@b.co',
    'first.last+tag@sub.example.test',
    "o'brien@example.test",
    '{a}!#$%&*/=?^_`|~-x@example.test',
  ])('accepts %s', (raw) => {
    expect(Email.parse(raw).value).toBe(raw.toLowerCase());
  });

  it.each([
    '',
    '   ',
    'no-at-sign',
    '@example.test',
    'user@',
    'user@nodot',
    'user@@example.test',
    'us er@example.test',
    'user@exa mple.test',
    'user@example..test',
    'a@b.c',
    // Address-list separators and header syntax: nodemailer would deliver
    // these to a second recipient, bypassing the per-email limit.
    'x,victim@example.test',
    'x;victim@example.test',
    'x<victim@example.test',
    'x>victim@example.test',
    '"x"@example.test',
    'x"y@example.test',
    'x(y)@example.test',
    'x[y]@example.test',
    'x:y@example.test',
    'x\\y@example.test',
    '.x@example.test',
    'x.@example.test',
    'x..y@example.test',
    'é@example.test',
  ])('rejects %j with InvalidInput', (raw) => {
    expect(() => Email.parse(raw)).toThrow(InvalidInput);
  });

  it('rejects control characters', () => {
    expect(() => Email.parse('user\u0000@example.test')).toThrow(InvalidInput);
    expect(() =>
      Email.parse('user@example.test\r\nBcc: x@example.test'),
    ).toThrow(InvalidInput);
  });

  it('rejects anything longer than 254 characters, accepts exactly 254', () => {
    const domain = `@${'d'.repeat(60)}.${'e'.repeat(60)}.${'f'.repeat(60)}.test`;
    const maxLocal = 'a'.repeat(254 - domain.length);
    expect(Email.parse(`${maxLocal}${domain}`).value).toHaveLength(254);
    expect(() => Email.parse(`a${maxLocal}${domain}`)).toThrow(InvalidInput);
  });

  it.each([undefined, null, 42, {}])('rejects non-string %p', (raw) => {
    expect(() => Email.parse(raw)).toThrow(InvalidInput);
  });

  it('compares by normalized value', () => {
    expect(
      Email.parse('A@Example.test').equals(Email.parse(' a@example.TEST')),
    ).toBe(true);
    expect(
      Email.parse('a@example.test').equals(Email.parse('b@example.test')),
    ).toBe(false);
  });
});
