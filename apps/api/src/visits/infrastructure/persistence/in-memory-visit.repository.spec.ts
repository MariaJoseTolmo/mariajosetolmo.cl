import type { VisitEvent } from '../../domain/visit-event';
import { describeVisitRepositoryContract } from '../../../../test/support/visit-repository.contract';
import { InMemoryVisitRepository } from './in-memory-visit.repository';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-30T12:00:00.123Z');
const RETAIN_FROM = new Date(NOW.getTime() - 180 * DAY_MS);

const event = (
  id: string,
  occurredAt: Date,
  userId = 'user-1',
): VisitEvent => ({ id, userId, kind: 'LOGIN', occurredAt });

const expired = (id: string, extraMs = 1): VisitEvent =>
  event(id, new Date(RETAIN_FROM.getTime() - extraMs));

describe('InMemoryVisitRepository.append', () => {
  let repo: InMemoryVisitRepository;
  beforeEach(() => {
    repo = new InMemoryVisitRepository();
  });

  it('stores the event with its id and exact instant', async () => {
    await repo.append(event('e-1', NOW), RETAIN_FROM);
    await repo.append(
      { id: 'e-2', userId: 'user-2', kind: 'CV_LINK', occurredAt: NOW },
      RETAIN_FROM,
    );
    expect(repo.all()).toEqual([
      { id: 'e-1', userId: 'user-1', kind: 'LOGIN', occurredAt: NOW },
      { id: 'e-2', userId: 'user-2', kind: 'CV_LINK', occurredAt: NOW },
    ]);
  });

  it('purges events older than retainFrom and keeps the rest', async () => {
    repo.seed(expired('old-1'));
    repo.seed(event('recent', NOW, 'user-2'));
    await repo.append(event('new', NOW), RETAIN_FROM);
    expect(repo.all().map((e) => e.id)).toEqual(['recent', 'new']);
  });

  it('keeps an event exactly on the boundary and purges one millisecond older', async () => {
    repo.seed(event('edge', RETAIN_FROM));
    repo.seed(expired('past'));
    await repo.append(event('now', NOW), RETAIN_FROM);
    expect(repo.all().map((e) => e.id)).toEqual(['edge', 'now']);
  });

  it('purges at most 100 events per write, oldest first', async () => {
    for (let i = 0; i < 105; i += 1) {
      // Older ids get older instants: e-0 is the oldest.
      repo.seed(expired(`old-${i}`, 1000 - i));
    }
    await repo.append(event('new', NOW), RETAIN_FROM);
    const left = repo.all().map((e) => e.id);
    expect(left).toHaveLength(5 + 1);
    expect(left).toEqual([
      'old-100',
      'old-101',
      'old-102',
      'old-103',
      'old-104',
      'new',
    ]);
  });

  it('never touches events of other users that are still retained', async () => {
    await repo.append(event('mine', NOW, 'user-1'), RETAIN_FROM);
    await repo.append(event('theirs', NOW, 'user-2'), RETAIN_FROM);
    await repo.append(event('mine-2', NOW, 'user-1'), RETAIN_FROM);
    expect(repo.all().map((e) => e.id)).toEqual(['mine', 'theirs', 'mine-2']);
  });
});

describeVisitRepositoryContract('InMemoryVisitRepository', () => {
  const users = new Map<
    string,
    { company: string | null; name: string | null }
  >();
  const repo = new InMemoryVisitRepository((id) => users.get(id) ?? null);
  let next = 0;
  return Promise.resolve({
    repo,
    addUser: (profile) => {
      next += 1;
      users.set(`user-${next}`, profile);
      return Promise.resolve(`user-${next}`);
    },
    removeUser: (userId) => {
      users.delete(userId);
      return Promise.resolve();
    },
    seed: (e) => {
      repo.seed(e);
      return Promise.resolve();
    },
  });
});
