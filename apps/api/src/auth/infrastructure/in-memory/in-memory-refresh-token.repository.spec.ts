import { InMemoryRefreshTokenRepository } from './in-memory-refresh-token.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const EXPIRES = new Date('2026-03-08T10:00:00.000Z');
const row = (tokenHash: string, familyId = 'f1') => ({
  userId: 'u1',
  familyId,
  tokenHash,
  expiresAt: EXPIRES,
});

/** The same contract the Postgres repository proves against a real database. */
describe('InMemoryRefreshTokenRepository', () => {
  it('rotates a token once and returns who and which family', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    await expect(repo.rotate('h1', 'h1-next', NOW)).resolves.toEqual({
      userId: 'u1',
      familyId: 'f1',
      expiresAt: EXPIRES,
    });
    await expect(repo.rotate('h1', 'h1-next', NOW)).resolves.toBeNull();
    expect(await repo.findByHash('h1')).toMatchObject({ usedAt: NOW });
  });

  it('refuses unknown, revoked and expired tokens (expiry is exclusive)', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    await repo.create(row('h2', 'f2'));
    await repo.create(row('h3', 'f3'));
    await repo.revokeFamily('f2', NOW);
    await expect(repo.rotate('nope', 'nope-next', NOW)).resolves.toBeNull();
    await expect(repo.rotate('h2', 'h2-next', NOW)).resolves.toBeNull();
    await expect(repo.rotate('h3', 'h3-next', EXPIRES)).resolves.toBeNull();
    await expect(
      repo.rotate('h1', 'h1-next', new Date(EXPIRES.getTime() - 1)),
    ).resolves.toMatchObject({ familyId: 'f1' });
  });

  it('lets one of many simultaneous rotations win', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    const results = await Promise.all(
      Array.from({ length: 10 }, () => repo.rotate('h1', 'h1-next', NOW)),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it('reports state, null for unknown', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    expect(await repo.findByHash('h1')).toEqual({
      userId: 'u1',
      familyId: 'f1',
      expiresAt: EXPIRES,
      usedAt: null,
      revokedAt: null,
    });
    expect(await repo.findByHash('nope')).toBeNull();
  });

  it('revokes a family (first time wins) and only that family', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('a1', 'fa'));
    await repo.create(row('a2', 'fa'));
    await repo.create(row('b1', 'fb'));
    await repo.revokeFamily('fa', NOW);
    await repo.revokeFamily('fa', new Date(NOW.getTime() + 1000));
    expect(await repo.findByHash('a1')).toMatchObject({ revokedAt: NOW });
    expect(await repo.findByHash('a2')).toMatchObject({ revokedAt: NOW });
    expect(await repo.findByHash('b1')).toMatchObject({ revokedAt: null });
  });

  it('revokeFamilyOf works through any token and ignores unknown ones', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('a1', 'fa'));
    await repo.create(row('a2', 'fa'));
    await repo.create(row('b1', 'fb'));
    await repo.rotate('a1', 'a1-next', NOW);
    await repo.revokeFamilyOf('nope', NOW);
    expect(await repo.findByHash('a2')).toMatchObject({ revokedAt: null });
    await repo.revokeFamilyOf('a1', NOW);
    expect(await repo.findByHash('a2')).toMatchObject({ revokedAt: NOW });
    expect(await repo.findByHash('b1')).toMatchObject({ revokedAt: null });
  });

  it('exposes the rows as created, without usage state', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    await repo.rotate('h1', 'h1-next', NOW);
    expect(repo.all()).toEqual([row('h1'), row('h1-next')]);
  });

  it('stores the successor in the same family with the same absolute end', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1', 'fam'));
    await repo.rotate('h1', 'h2', NOW);
    expect(await repo.findByHash('h2')).toEqual({
      userId: 'u1',
      familyId: 'fam',
      expiresAt: EXPIRES,
      usedAt: null,
      revokedAt: null,
    });
    expect(repo.all().map((r) => r.tokenHash)).toEqual(['h1', 'h2']);
  });

  it('creates nothing when it refuses', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1'));
    await repo.revokeFamily('f1', NOW);
    await expect(repo.rotate('h1', 'h2', NOW)).resolves.toBeNull();
    await expect(repo.rotate('nope', 'h3', NOW)).resolves.toBeNull();
    expect(repo.all().map((r) => r.tokenHash)).toEqual(['h1']);
  });

  it('refuses a live token whose family already has a revoked row (revoke landed first)', async () => {
    const repo = new InMemoryRefreshTokenRepository();
    await repo.create(row('h1', 'fam'));
    await repo.revokeFamily('fam', NOW);
    // A straggler written after the revocation, as a racing rotation would.
    await repo.create(row('late', 'fam'));
    await expect(repo.rotate('late', 'late-next', NOW)).resolves.toBeNull();
    expect(await repo.findByHash('late-next')).toBeNull();
  });
});
