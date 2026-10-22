import { AdminPolicy } from './admin-policy';
import { Email } from './email';

const roleFor = (email: string, adminEmail: string): string =>
  AdminPolicy.roleFor(Email.parse(email), adminEmail);

describe('AdminPolicy.roleFor', () => {
  it('gives RECRUITER to anyone but the configured administrator', () => {
    expect(roleFor('recruiter@example.test', 'admin@example.test')).toBe(
      'RECRUITER',
    );
  });

  it('gives ADMIN to the configured email', () => {
    expect(roleFor('admin@example.test', 'admin@example.test')).toBe('ADMIN');
  });

  it('ignores case in either side', () => {
    expect(roleFor('Admin@Example.test', 'admin@example.test')).toBe('ADMIN');
    expect(roleFor('admin@example.test', 'ADMIN@EXAMPLE.TEST')).toBe('ADMIN');
  });

  it('ignores whitespace around the configured email', () => {
    expect(roleFor('admin@example.test', '  admin@example.test \n')).toBe(
      'ADMIN',
    );
  });

  it.each([
    ['a longer local part', 'xadmin@example.test'],
    ['a longer domain', 'admin@example.test.evil.test'],
    ['a plus alias', 'admin+x@example.test'],
    ['another domain', 'admin@example.org'],
  ])('does not treat %s as the administrator', (_label, email) => {
    expect(roleFor(email, 'admin@example.test')).toBe('RECRUITER');
  });

  it('never matches an empty configuration', () => {
    expect(roleFor('recruiter@example.test', '')).toBe('RECRUITER');
    expect(roleFor('recruiter@example.test', '   ')).toBe('RECRUITER');
  });
});
