import { FakeClock } from '../../../test/support/fakes/fake-clock';
import { CapturingLogger } from '../../../test/support/fakes/capturing-logger';
import { InMemoryRefreshTokenRepository } from '../../../test/support/fakes/in-memory-auth-stores';
import { SequenceRandomSource } from '../../../test/support/fakes/sequence-random';
import { InfrastructureUnavailable } from '../../shared/domain/errors';
import { RefreshToken } from '../domain/refresh-token';
import { Logout } from './logout.use-case';
import type { RefreshTokenRepository } from './ports/refresh-token-repository.port';

const NOW = new Date('2026-01-02T00:00:00.000Z');
const END = new Date('2026-01-08T00:00:00.000Z');

function setup(
  wrap?: (base: InMemoryRefreshTokenRepository) => RefreshTokenRepository,
) {
  const clock = new FakeClock(NOW);
  const repo = new InMemoryRefreshTokenRepository();
  const logger = new CapturingLogger();
  const random = new SequenceRandomSource();
  const useCase = new Logout(wrap ? wrap(repo) : repo, clock, logger);
  const open = async (familyId: string): Promise<RefreshToken> => {
    const token = RefreshToken.generate(random);
    await repo.create({
      userId: 'user-1',
      familyId,
      tokenHash: token.hash,
      expiresAt: END,
    });
    return token;
  };
  return { useCase, repo, logger, open };
}

describe('Logout', () => {
  it('revokes the whole family of a known token', async () => {
    const t = setup();
    const a1 = await t.open('fam-A');
    const a2 = await t.open('fam-A');
    await t.useCase.execute({ refreshToken: a1.value });
    expect(await t.repo.findByHash(a1.hash)).toMatchObject({ revokedAt: NOW });
    expect(await t.repo.findByHash(a2.hash)).toMatchObject({ revokedAt: NOW });
  });

  it('leaves other families alone', async () => {
    const t = setup();
    const a = await t.open('fam-A');
    const b = await t.open('fam-B');
    await t.useCase.execute({ refreshToken: a.value });
    expect(await t.repo.findByHash(b.hash)).toMatchObject({ revokedAt: null });
  });

  it('works with a token that was already spent', async () => {
    const t = setup();
    const a1 = await t.open('fam-A');
    await t.repo.rotate(a1.hash, 'next-hash', NOW);
    await t.useCase.execute({ refreshToken: a1.value });
    expect(await t.repo.findByHash(a1.hash)).toMatchObject({ revokedAt: NOW });
  });

  it.each([
    ['missing', undefined],
    ['not a string', 5],
    ['the wrong shape', 'short'],
  ])('%s: resolves and touches nothing', async (_label, value) => {
    const t = setup();
    const a = await t.open('fam-A');
    await expect(
      t.useCase.execute({ refreshToken: value }),
    ).resolves.toBeUndefined();
    expect(await t.repo.findByHash(a.hash)).toMatchObject({ revokedAt: null });
  });

  it('an unknown but well formed token resolves and revokes nothing', async () => {
    const t = setup();
    const a = await t.open('fam-A');
    const stranger = RefreshToken.generate(new SequenceRandomSource(200));
    await expect(
      t.useCase.execute({ refreshToken: stranger.value }),
    ).resolves.toBeUndefined();
    expect(await t.repo.findByHash(a.hash)).toMatchObject({ revokedAt: null });
  });

  it('never fails when the database is down: it logs the failure kind only', async () => {
    const t = setup((base) => ({
      ...bind(base),
      revokeFamilyOf: () =>
        Promise.reject(
          new InfrastructureUnavailable(
            new Error('connect ECONNREFUSED 10.0.0.9'),
          ),
        ),
    }));
    const a = await t.open('fam-A');
    await expect(
      t.useCase.execute({ refreshToken: a.value }),
    ).resolves.toBeUndefined();
    expect(t.logger.warnings).toEqual([
      'Logout could not revoke the session: InfrastructureUnavailable INFRASTRUCTURE_UNAVAILABLE',
    ]);
    expect(t.logger.errors).toHaveLength(0);
    expect(t.logger.warnings.join()).not.toContain(a.value);
    expect(t.logger.warnings.join()).not.toContain('10.0.0.9');
  });

  it('does not log anything when it succeeds or has nothing to do', async () => {
    const t = setup();
    const a = await t.open('fam-A');
    await t.useCase.execute({ refreshToken: a.value });
    await t.useCase.execute({ refreshToken: undefined });
    expect(t.logger.errors).toHaveLength(0);
    expect(t.logger.warnings).toHaveLength(0);
  });
});

function bind(base: InMemoryRefreshTokenRepository): RefreshTokenRepository {
  return {
    create: (row) => base.create(row),
    rotate: (hash, next, now) => base.rotate(hash, next, now),
    findByHash: (hash) => base.findByHash(hash),
    revokeFamily: (id, now) => base.revokeFamily(id, now),
    revokeFamilyOf: (hash, now) => base.revokeFamilyOf(hash, now),
  };
}
