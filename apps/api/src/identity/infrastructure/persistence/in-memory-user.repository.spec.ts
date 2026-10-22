import { Email } from '../../domain/email';
import { InMemoryUserRepository } from './in-memory-user.repository';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const login = (
  email: string,
  extra: {
    role?: 'RECRUITER' | 'ADMIN';
    company?: string | null;
    name?: string | null;
  } = {},
): Parameters<InMemoryUserRepository['upsertOnLogin']>[0] => ({
  email: Email.parse(email),
  role: extra.role ?? 'RECRUITER',
  company: extra.company ?? null,
  name: extra.name ?? null,
});

describe('InMemoryUserRepository.upsertOnLogin (mirrors the SQL upsert)', () => {
  it('creates a user with an id and the given fields', async () => {
    const repo = new InMemoryUserRepository();
    const user = await repo.upsertOnLogin(
      login('a@example.test', { company: 'Acme', name: 'Ana' }),
      NOW,
    );
    expect(user).toMatchObject({
      email: Email.parse('a@example.test'),
      role: 'RECRUITER',
      company: 'Acme',
      name: 'Ana',
    });
    expect(user.id).not.toBe('');
    await expect(repo.findById(user.id)).resolves.toEqual(user);
  });

  it('keeps the id and the stored company and name when the login has none', async () => {
    const repo = new InMemoryUserRepository();
    const first = await repo.upsertOnLogin(
      login('a@example.test', { company: 'Acme', name: 'Ana' }),
      NOW,
    );
    const second = await repo.upsertOnLogin(login('a@example.test'), NOW);
    expect(second.id).toBe(first.id);
    expect(second.company).toBe('Acme');
    expect(second.name).toBe('Ana');
    expect(repo.all()).toHaveLength(1);
  });

  it('replaces company and name when the login brings new ones', async () => {
    const repo = new InMemoryUserRepository();
    await repo.upsertOnLogin(login('a@example.test', { company: 'Acme' }), NOW);
    const updated = await repo.upsertOnLogin(
      login('a@example.test', { company: 'Otra', name: 'Ana' }),
      NOW,
    );
    expect(updated).toMatchObject({ company: 'Otra', name: 'Ana' });
  });

  it('always overwrites the role, both ways', async () => {
    const repo = new InMemoryUserRepository();
    await repo.upsertOnLogin(login('a@example.test', { role: 'ADMIN' }), NOW);
    const demoted = await repo.upsertOnLogin(login('a@example.test'), NOW);
    expect(demoted.role).toBe('RECRUITER');
    const promoted = await repo.upsertOnLogin(
      login('a@example.test', { role: 'ADMIN' }),
      NOW,
    );
    expect(promoted.role).toBe('ADMIN');
  });

  it('gives different users different ids', async () => {
    const repo = new InMemoryUserRepository();
    const a = await repo.upsertOnLogin(login('a@example.test'), NOW);
    const b = await repo.upsertOnLogin(login('b@example.test'), NOW);
    expect(a.id).not.toBe(b.id);
  });
});
