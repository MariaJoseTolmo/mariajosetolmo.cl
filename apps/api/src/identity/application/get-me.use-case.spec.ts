import {
  InMemoryAvailabilityRepository,
  InMemoryUserRepository,
} from '../../../test/support/fakes/in-memory-repositories';
import { Unauthenticated } from '../../shared/domain/errors';
import { Email } from '../domain/email';
import type { User } from '../domain/user';
import { GetMe } from './get-me.use-case';

const AVAILABILITY = {
  modality: 'example modality',
  start: 'example start',
  salary: 'example salary',
};

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: Email.parse('recruiter@example.test'),
    role: 'RECRUITER',
    company: 'Acme',
    name: 'Ana',
    ...overrides,
  };
}

function build(users: User[] = []): GetMe {
  const repo = new InMemoryUserRepository();
  users.forEach((u) => repo.seed(u));
  return new GetMe(repo, new InMemoryAvailabilityRepository(AVAILABILITY));
}

describe('GetMe', () => {
  it('returns the strict profile with the availability labels', async () => {
    const me = await build([user()]).execute({
      userId: 'user-1',
      role: 'RECRUITER',
    });
    expect(me).toEqual({
      email: 'recruiter@example.test',
      role: 'RECRUITER',
      company: 'Acme',
      name: 'Ana',
      availability: AVAILABILITY,
    });
  });

  it('keeps company and name as null, never omitted', async () => {
    const me = await build([user({ company: null, name: null })]).execute({
      userId: 'user-1',
      role: 'RECRUITER',
    });
    expect(me.company).toBeNull();
    expect(me.name).toBeNull();
    expect(Object.keys(me).sort()).toEqual([
      'availability',
      'company',
      'email',
      'name',
      'role',
    ]);
  });

  it('reports the stored role (ADMIN), not an unchecked claim', async () => {
    const me = await build([
      user({
        id: 'admin-1',
        email: Email.parse('admin@example.test'),
        role: 'ADMIN',
      }),
    ]).execute({ userId: 'admin-1', role: 'RECRUITER' });
    expect(me.role).toBe('ADMIN');
  });

  it('is unauthenticated when the user no longer exists', async () => {
    await expect(
      build().execute({ userId: 'ghost', role: 'RECRUITER' }),
    ).rejects.toThrow(Unauthenticated);
  });
});
