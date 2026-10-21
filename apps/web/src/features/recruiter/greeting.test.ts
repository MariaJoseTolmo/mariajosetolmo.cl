import { greeting } from './greeting';

describe('greeting', () => {
  it('prefers the company over the name', () => {
    expect(greeting({ company: 'Acme', name: 'Ana' })).toBe(
      'Gracias por tu interés, equipo de Acme',
    );
  });

  it('falls back to the name when there is no company', () => {
    expect(greeting({ company: null, name: 'Ana' })).toBe(
      'Gracias por tu interés, Ana',
    );
  });

  it('falls back to the plain greeting', () => {
    expect(greeting({ company: null, name: null })).toBe(
      'Gracias por tu interés',
    );
  });

  it('trims the values and treats blanks as missing', () => {
    expect(greeting({ company: '  Globex  ', name: 'Ana' })).toBe(
      'Gracias por tu interés, equipo de Globex',
    );
    expect(greeting({ company: '   ', name: '  Beto ' })).toBe(
      'Gracias por tu interés, Beto',
    );
    expect(greeting({ company: '', name: '   ' })).toBe(
      'Gracias por tu interés',
    );
  });
});
