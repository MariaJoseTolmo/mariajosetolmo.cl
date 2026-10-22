import { isRole, ROLES } from './role';

describe('Role', () => {
  it('lists exactly the two roles', () => {
    expect([...ROLES]).toEqual(['RECRUITER', 'ADMIN']);
  });

  it.each(['RECRUITER', 'ADMIN'])('isRole accepts %s', (value) => {
    expect(isRole(value)).toBe(true);
  });

  it.each(['admin', 'ROOT', '', 'RECRUITER ', 42, null, undefined])(
    'isRole rejects %j',
    (value) => {
      expect(isRole(value)).toBe(false);
    },
  );
});
