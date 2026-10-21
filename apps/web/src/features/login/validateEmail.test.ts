import { validateEmail } from './validateEmail';

describe('validateEmail', () => {
  it.each(['', '   '])('reports %j as empty', (value) => {
    expect(validateEmail(value)).toBe('empty');
  });

  it.each(['no-es-correo', 'a@b', '@b.cl', 'a@.cl', 'a b@c.cl', 'a@b@c.cl'])(
    'reports %j as invalid',
    (value) => {
      expect(validateEmail(value)).toBe('invalid');
    },
  );

  it.each(['ana@empresa.com', '  ana@empresa.com  ', 'a.b+c@sub.empresa.cl'])(
    'accepts %j',
    (value) => {
      expect(validateEmail(value)).toBeNull();
    },
  );
});
