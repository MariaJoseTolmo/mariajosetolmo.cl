import { FakeAccessTokenIssuer } from '../../../test/support/fakes/fake-access-token-issuer';
import { FakeClock } from '../../../test/support/fakes/fake-clock';
import {
  InMemoryRateLimiter,
  InMemoryRefreshTokenRepository,
} from '../../../test/support/fakes/in-memory-auth-stores';
import { InMemoryUserRepository } from '../../../test/support/fakes/in-memory-repositories';
import { SequenceRandomSource } from '../../../test/support/fakes/sequence-random';
import { Email } from '../../identity/domain/email';
import type { Role } from '../../identity/domain/role';
import {
  InfrastructureUnavailable,
  RateLimited,
} from '../../shared/domain/errors';
import { sha256Hex } from '../../shared/domain/hash';
import { RefreshToken } from '../domain/refresh-token';
import { SessionPolicy } from '../domain/session-policy';
import type { UserRepository } from '../../identity/application/ports/user-repository.port';
import type { RateLimiter } from './ports/rate-limiter.port';
import type { RefreshTokenRepository } from './ports/refresh-token-repository.port';
import {
  type RefreshResult,
  RefreshSession,
  type RefreshSessionOptions,
} from './refresh-session.use-case';

const LOGIN = new Date('2026-01-01T00:00:00.000Z');
const SESSION_END = new Date('2026-01-08T00:00:00.000Z');

interface Setup {
  useCase: RefreshSession;
  clock: FakeClock;
  users: InMemoryUserRepository;
  repo: InMemoryRefreshTokenRepository;
  issuer: FakeAccessTokenIssuer;
  /** Opens a session as `verify` would; returns its clear refresh token. */
  login(options?: {
    familyId?: string;
    userId?: string;
    role?: Role;
  }): Promise<string>;
}

function setup(
  options: Partial<RefreshSessionOptions> = {},
  overrides: {
    limiter?: RateLimiter;
    /** Wraps the user store the use case reads (login keeps the raw one). */
    wrapUsers?: (base: InMemoryUserRepository) => UserRepository;
    /** Wraps the in-memory repository the use case talks to (login keeps the raw one). */
    wrapRepo?: (base: InMemoryRefreshTokenRepository) => RefreshTokenRepository;
  } = {},
): Setup {
  const clock = new FakeClock(LOGIN);
  const users = new InMemoryUserRepository();
  const repo = new InMemoryRefreshTokenRepository();
  const issuer = new FakeAccessTokenIssuer();
  const loginRandom = new SequenceRandomSource();
  const useCase = new RefreshSession(
    overrides.limiter ?? new InMemoryRateLimiter(clock),
    overrides.wrapRepo ? overrides.wrapRepo(repo) : repo,
    overrides.wrapUsers ? overrides.wrapUsers(users) : users,
    issuer,
    // Offset so rotated tokens never collide with the login ones.
    new SequenceRandomSource(100),
    clock,
    { ipRule: { limit: 60, windowSeconds: 900 }, ...options },
  );
  let sessions = 0;
  return {
    useCase,
    clock,
    users,
    repo,
    issuer,
    async login({ familyId, userId = 'user-1', role = 'RECRUITER' } = {}) {
      sessions += 1;
      users.seed({
        id: userId,
        email: Email.parse(`${userId}@example.test`),
        role,
        company: null,
        name: null,
      });
      const token = RefreshToken.generate(loginRandom);
      await repo.create({
        userId,
        familyId: familyId ?? `family-${sessions}`,
        tokenHash: token.hash,
        expiresAt: SessionPolicy.sessionExpiresAt(clock.now()),
      });
      return token.value;
    },
  };
}

const refresh = (
  t: Setup,
  refreshToken: unknown,
  ip = '203.0.113.1',
): Promise<RefreshResult> => t.useCase.execute({ refreshToken, ip });

const issued = (result: RefreshResult) => {
  if (result.kind !== 'issued') throw new Error('expected a new session');
  return result.session;
};

describe('RefreshSession', () => {
  describe('rotation', () => {
    it('returns a new token and a new access JWT, and spends the old token', async () => {
      const t = setup();
      const r1 = await t.login();
      const session = issued(await refresh(t, r1));

      expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(session.refreshToken).not.toBe(r1);
      expect(session.accessJwt).toBe('jwt.user-1.RECRUITER');
      expect(t.issuer.issued).toEqual([
        { claims: { sub: 'user-1', role: 'RECRUITER' }, now: LOGIN },
      ]);
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: LOGIN,
      });
    });

    it('keeps the family and the absolute expiry; stores only the new hash', async () => {
      const t = setup();
      const r1 = await t.login({ familyId: 'fam-A' });
      t.clock.advanceSeconds(3 * 24 * 3600);
      const session = issued(await refresh(t, r1));

      expect(session.refreshExpiresAt).toEqual(SESSION_END);
      const [, child] = t.repo.all();
      expect(t.repo.all()).toHaveLength(2);
      expect(child).toEqual({
        userId: 'user-1',
        familyId: 'fam-A',
        tokenHash: sha256Hex(session.refreshToken),
        expiresAt: SESSION_END,
      });
      expect(JSON.stringify(t.repo.all())).not.toContain(session.refreshToken);
    });

    it('never extends the session: chained refreshes keep the same end date', async () => {
      const t = setup();
      let token = await t.login();
      for (let day = 1; day <= 3; day += 1) {
        t.clock.advanceSeconds(24 * 3600);
        const session = issued(await refresh(t, token));
        expect(session.refreshExpiresAt).toEqual(SESSION_END);
        token = session.refreshToken;
      }
      expect(t.repo.all()).toHaveLength(4);
    });

    it('takes the role from the stored user, so a demotion shows up at refresh', async () => {
      const t = setup();
      const r1 = await t.login({ role: 'ADMIN' });
      await t.users.upsertOnLogin(
        {
          email: Email.parse('user-1@example.test'),
          role: 'RECRUITER',
          company: null,
          name: null,
        },
        LOGIN,
      );
      issued(await refresh(t, r1));
      expect(t.issuer.issued[0]?.claims).toEqual({
        sub: 'user-1',
        role: 'RECRUITER',
      });
    });
  });

  describe('absolute expiry', () => {
    it('is refused at 7 days, with cookies cleared and no family revocation', async () => {
      const t = setup();
      const r1 = await t.login();
      t.clock.set(SESSION_END);
      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: null,
        revokedAt: null,
      });
    });

    it('still works one second before', async () => {
      const t = setup();
      const r1 = await t.login();
      t.clock.set(new Date(SESSION_END.getTime() - 1000));
      expect(issued(await refresh(t, r1)).refreshExpiresAt).toEqual(
        SESSION_END,
      );
    });
  });

  describe('no usable token', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not a string', 7],
      ['the wrong shape', 'short'],
    ])(
      '%s: 401 with cookies cleared, before touching Redis or the database',
      async (_label, value) => {
        let hits = 0;
        const t = setup(
          {},
          {
            limiter: {
              hit: () => {
                hits += 1;
                return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
              },
            },
          },
        );
        await t.login();
        expect(await refresh(t, value)).toEqual({
          kind: 'rejected',
          clearCookies: true,
        });
        expect(hits).toBe(0);
        expect(t.issuer.issued).toHaveLength(0);
      },
    );

    it('unknown but well formed token: counted, 401, cookies cleared', async () => {
      let hits = 0;
      const t = setup(
        {},
        {
          limiter: {
            hit: () => {
              hits += 1;
              return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
            },
          },
        },
      );
      await t.login();
      const stranger = RefreshToken.generate(new SequenceRandomSource(200));
      expect(await refresh(t, stranger.value)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(hits).toBe(1);
      expect(t.repo.all()).toHaveLength(1);
    });
  });

  describe('reuse detection', () => {
    it('reuse after more than 10 s revokes the family, so even the newest token dies', async () => {
      const t = setup();
      const r1 = await t.login();
      const r2 = issued(await refresh(t, r1)).refreshToken;
      t.clock.advanceSeconds(11);

      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(await refresh(t, r2)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(await t.repo.findByHash(sha256Hex(r2))).toMatchObject({
        revokedAt: new Date(LOGIN.getTime() + 11_000),
      });
    });

    it('reuse within 10 s is a plain 401: no revocation, cookies untouched, R2 still works', async () => {
      const t = setup();
      const r1 = await t.login();
      const r2 = issued(await refresh(t, r1)).refreshToken;
      t.clock.advanceSeconds(10);

      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: false,
      });
      expect(await t.repo.findByHash(sha256Hex(r2))).toMatchObject({
        revokedAt: null,
      });
      expect(issued(await refresh(t, r2)).refreshToken).not.toBe(r2);
    });

    it('revokes at 10.001 s but not at 10 s (boundary)', async () => {
      const t = setup();
      const r1 = await t.login();
      issued(await refresh(t, r1));
      t.clock.set(new Date(LOGIN.getTime() + 10_001));
      expect(await refresh(t, r1)).toMatchObject({ clearCookies: true });
    });

    it('a revoked token that was never used is refused and revokes its family', async () => {
      const t = setup();
      const r1 = await t.login({ familyId: 'fam-A' });
      await t.repo.revokeFamily('fam-A', LOGIN);
      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
    });

    it('leaves another family of the same user alone', async () => {
      const t = setup();
      const a1 = await t.login({ familyId: 'fam-A' });
      const b1 = await t.login({ familyId: 'fam-B' });
      issued(await refresh(t, a1));
      t.clock.advanceSeconds(30);
      expect(await refresh(t, a1)).toMatchObject({ clearCookies: true });

      expect(issued(await refresh(t, b1)).refreshToken).toMatch(/^[\w-]{43}$/);
    });

    it('two simultaneous refreshes of one token: exactly one rotates, the loser is the harmless race', async () => {
      const t = setup();
      const r1 = await t.login();
      const results = await Promise.all([refresh(t, r1), refresh(t, r1)]);
      expect(results.filter((r) => r.kind === 'issued')).toHaveLength(1);
      expect(results).toContainEqual({ kind: 'rejected', clearCookies: false });
      expect(t.repo.all()).toHaveLength(2);
    });
  });

  describe('user gone', () => {
    it('refuses, clears cookies and revokes the family', async () => {
      const t = setup();
      const r1 = await t.login({ familyId: 'fam-A' });
      t.users.remove('user-1');
      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(t.issuer.issued).toHaveLength(0);
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        revokedAt: LOGIN,
      });
    });
  });

  describe('rate limit per IP', () => {
    it('refuses the attempt over the limit with the seconds left and does not consume the token', async () => {
      const t = setup({ ipRule: { limit: 2, windowSeconds: 900 } });
      const r1 = await t.login();
      const stranger = RefreshToken.generate(new SequenceRandomSource(200));
      await refresh(t, stranger.value);
      await refresh(t, stranger.value);
      t.clock.advanceSeconds(100);
      const refused = refresh(t, r1);
      await expect(refused).rejects.toBeInstanceOf(RateLimited);
      await expect(refused).rejects.toMatchObject({ retryAfterSeconds: 800 });
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: null,
      });
    });

    it('counts per IP: another address still passes', async () => {
      const t = setup({ ipRule: { limit: 1, windowSeconds: 900 } });
      const r1 = await t.login();
      const stranger = RefreshToken.generate(new SequenceRandomSource(200));
      await refresh(t, stranger.value, '203.0.113.1');
      await expect(
        refresh(t, stranger.value, '203.0.113.1'),
      ).rejects.toBeInstanceOf(RateLimited);
      expect(issued(await refresh(t, r1, '203.0.113.2')).accessJwt).toContain(
        'user-1',
      );
    });

    it('shares one counter inside an IPv6 /64', async () => {
      const t = setup({ ipRule: { limit: 1, windowSeconds: 900 } });
      const stranger = RefreshToken.generate(new SequenceRandomSource(200));
      await refresh(t, stranger.value, '2001:db8:1:2::1');
      await expect(
        refresh(t, stranger.value, '2001:db8:1:2:ffff::9'),
      ).rejects.toBeInstanceOf(RateLimited);
    });
  });

  describe('stores down', () => {
    it('limiter down: InfrastructureUnavailable, token untouched', async () => {
      const t = setup(
        {},
        {
          limiter: {
            hit: () => Promise.reject(new InfrastructureUnavailable()),
          },
        },
      );
      const r1 = await t.login();
      await expect(refresh(t, r1)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: null,
      });
    });

    const delegating = (base: InMemoryRefreshTokenRepository) => ({
      create: (row: Parameters<RefreshTokenRepository['create']>[0]) =>
        base.create(row),
      rotate: (hash: string, next: string, now: Date) =>
        base.rotate(hash, next, now),
      findByHash: (hash: string) => base.findByHash(hash),
      revokeFamily: (id: string, now: Date) => base.revokeFamily(id, now),
      revokeFamilyOf: (hash: string, now: Date) =>
        base.revokeFamilyOf(hash, now),
    });

    it('database down on the read: 503, nothing touched', async () => {
      const t = setup(
        {},
        {
          wrapRepo: (base) => ({
            ...delegating(base),
            findByHash: () => Promise.reject(new InfrastructureUnavailable()),
          }),
        },
      );
      const r1 = await t.login();
      await expect(refresh(t, r1)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      expect(t.issuer.issued).toHaveLength(0);
    });

    it('user lookup failing: 503, the old token is NOT spent and a retry works', async () => {
      let failing = true;
      const t = setup(
        {},
        {
          wrapUsers: (base) => ({
            upsertOnLogin: (login, now) => base.upsertOnLogin(login, now),
            findById: (id) =>
              failing
                ? Promise.reject(new InfrastructureUnavailable())
                : base.findById(id),
          }),
        },
      );
      const r1 = await t.login();
      await expect(refresh(t, r1)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      expect(t.issuer.issued).toHaveLength(0);
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: null,
        revokedAt: null,
      });
      failing = false;
      expect(issued(await refresh(t, r1)).refreshToken).toMatch(/^[\w-]{43}$/);
    });

    it('rotation failing: 503, no JWT issued, the old token is NOT spent and a retry works', async () => {
      let failing = true;
      const t = setup(
        {},
        {
          wrapRepo: (base) => ({
            ...delegating(base),
            rotate: (hash, next, now) =>
              failing
                ? Promise.reject(new InfrastructureUnavailable())
                : base.rotate(hash, next, now),
          }),
        },
      );
      const r1 = await t.login();
      await expect(refresh(t, r1)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
      expect(t.issuer.issued).toHaveLength(0);
      expect(t.repo.all()).toHaveLength(1);
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        usedAt: null,
      });
      failing = false;
      issued(await refresh(t, r1));
      expect(t.repo.all()).toHaveLength(2);
    });

    it('signs the JWT only after the rotation succeeded', async () => {
      const order: string[] = [];
      const t = setup(
        {},
        {
          wrapRepo: (base) => ({
            ...delegating(base),
            rotate: (hash, next, now) => {
              order.push('rotate');
              return base.rotate(hash, next, now);
            },
          }),
        },
      );
      const original = t.issuer.issue.bind(t.issuer);
      t.issuer.issue = (claims, now) => {
        order.push('issue');
        return original(claims, now);
      };
      issued(await refresh(t, await t.login()));
      expect(order).toEqual(['rotate', 'issue']);
    });
  });

  describe('revocation racing the rotation', () => {
    it('a revoke landing between the read and the rotation leaves no live token and answers a cleared 401', async () => {
      const t = setup(
        {},
        {
          wrapRepo: (base) => ({
            create: (row) => base.create(row),
            findByHash: (hash) => base.findByHash(hash),
            revokeFamily: (id, now) => base.revokeFamily(id, now),
            revokeFamilyOf: (hash, now) => base.revokeFamilyOf(hash, now),
            // The logout (or a reuse detection) lands right before the rotation.
            rotate: async (hash, next, now) => {
              await base.revokeFamily('fam-A', now);
              return base.rotate(hash, next, now);
            },
          }),
        },
      );
      const r1 = await t.login({ familyId: 'fam-A' });
      expect(await refresh(t, r1)).toEqual({
        kind: 'rejected',
        clearCookies: true,
      });
      expect(t.issuer.issued).toHaveLength(0);
      expect(t.repo.all()).toHaveLength(1);
      expect(await t.repo.findByHash(sha256Hex(r1))).toMatchObject({
        revokedAt: LOGIN,
      });
    });
  });
});
