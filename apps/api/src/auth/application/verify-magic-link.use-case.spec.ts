import { FakeAccessTokenIssuer } from '../../../test/support/fakes/fake-access-token-issuer';
import { FakeClock } from '../../../test/support/fakes/fake-clock';
import {
  InMemoryMagicLinkStore,
  InMemoryRateLimiter,
  InMemoryRefreshTokenRepository,
} from '../../../test/support/fakes/in-memory-auth-stores';
import { InMemoryUserRepository } from '../../../test/support/fakes/in-memory-repositories';
import { SequenceIdGenerator } from '../../../test/support/fakes/sequence-id-generator';
import { SequenceRandomSource } from '../../../test/support/fakes/sequence-random';
import { Email } from '../../identity/domain/email';
import {
  InfrastructureUnavailable,
  InvalidInput,
  RateLimited,
} from '../../shared/domain/errors';
import { sha256Hex } from '../../shared/domain/hash';
import { InvalidMagicLink, MalformedToken } from '../domain/auth-errors';
import { MagicLinkToken } from '../domain/magic-link-token';
import type {
  MagicLinkPayload,
  MagicLinkStore,
} from './ports/magic-link-store.port';
import type { RateLimiter } from './ports/rate-limiter.port';
import type { UserRepository } from '../../identity/application/ports/user-repository.port';
import {
  VerifyMagicLink,
  type VerifyMagicLinkOptions,
} from './verify-magic-link.use-case';

const NOW = new Date('2026-01-01T00:00:00.000Z');

interface Setup {
  useCase: VerifyMagicLink;
  clock: FakeClock;
  store: InMemoryMagicLinkStore;
  users: InMemoryUserRepository;
  refresh: InMemoryRefreshTokenRepository;
  issuer: FakeAccessTokenIssuer;
  /** Saves a magic link as the request step would and returns the token. */
  issueLink(payload: MagicLinkPayload): Promise<string>;
}

function setup(
  options: Partial<VerifyMagicLinkOptions> = {},
  overrides: {
    store?: MagicLinkStore;
    limiter?: RateLimiter;
    users?: UserRepository;
  } = {},
): Setup {
  const clock = new FakeClock(NOW);
  const store = new InMemoryMagicLinkStore(clock);
  const users = new InMemoryUserRepository();
  const refresh = new InMemoryRefreshTokenRepository();
  const issuer = new FakeAccessTokenIssuer();
  const random = new SequenceRandomSource();
  const useCase = new VerifyMagicLink(
    overrides.limiter ?? new InMemoryRateLimiter(clock),
    overrides.store ?? store,
    overrides.users ?? users,
    refresh,
    issuer,
    new SequenceIdGenerator(),
    random,
    clock,
    {
      adminEmail: 'admin@example.test',
      ipRule: { limit: 20, windowSeconds: 900 },
      ...options,
    },
  );
  const linkRandom = new SequenceRandomSource();
  return {
    useCase,
    clock,
    store,
    users,
    refresh,
    issuer,
    async issueLink(payload) {
      const token = MagicLinkToken.generate(linkRandom);
      await store.save(token.hash, payload, 900);
      return token.value;
    },
  };
}

const verify = (
  t: Setup,
  token: unknown,
  ip = '203.0.113.1',
): ReturnType<VerifyMagicLink['execute']> => t.useCase.execute({ token, ip });

describe('VerifyMagicLink', () => {
  describe('a valid link', () => {
    it('creates a RECRUITER with the company and name from the link, and opens a session', async () => {
      const t = setup();
      const token = await t.issueLink({
        email: 'new@example.test',
        company: 'Acme',
        name: 'Ana',
      });
      const session = await verify(t, token);

      const [user] = t.users.all();
      expect(user).toMatchObject({
        role: 'RECRUITER',
        company: 'Acme',
        name: 'Ana',
      });
      expect(user?.email.value).toBe('new@example.test');
      expect(t.issuer.issued).toEqual([
        { claims: { sub: user?.id, role: 'RECRUITER' }, now: NOW },
      ]);
      expect(session.accessJwt).toBe(`jwt.${user?.id}.RECRUITER`);
    });

    it('stores only the hash of the refresh token, valid for 7 days from now', async () => {
      const t = setup();
      const token = await t.issueLink({ email: 'new@example.test' });
      const session = await verify(t, token);

      expect(session.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(session.refreshExpiresAt).toEqual(
        new Date('2026-01-08T00:00:00.000Z'),
      );
      const [row] = t.refresh.all();
      expect(t.refresh.all()).toHaveLength(1);
      expect(row).toEqual({
        userId: t.users.all()[0]?.id,
        familyId: 'id-1',
        tokenHash: sha256Hex(session.refreshToken),
        expiresAt: session.refreshExpiresAt,
      });
      expect(JSON.stringify(t.refresh.all())).not.toContain(
        session.refreshToken,
      );
    });

    it('gives each login its own refresh token and family', async () => {
      const t = setup();
      const first = await verify(
        t,
        await t.issueLink({ email: 'a@example.test' }),
      );
      const second = await verify(
        t,
        await t.issueLink({ email: 'a@example.test' }),
      );
      expect(second.refreshToken).not.toBe(first.refreshToken);
      const [a, b] = t.refresh.all();
      expect(a?.familyId).not.toBe(b?.familyId);
      expect(t.users.all()).toHaveLength(1);
    });

    it('keeps the company and name of an existing user when the link brings none', async () => {
      const t = setup();
      await verify(
        t,
        await t.issueLink({
          email: 'a@example.test',
          company: 'Acme',
          name: 'Ana',
        }),
      );
      await verify(t, await t.issueLink({ email: 'a@example.test' }));
      expect(t.users.all()[0]).toMatchObject({ company: 'Acme', name: 'Ana' });
    });

    it('applies the company of the link when it brings one', async () => {
      const t = setup();
      await verify(
        t,
        await t.issueLink({ email: 'a@example.test', company: 'Acme' }),
      );
      await verify(
        t,
        await t.issueLink({ email: 'a@example.test', company: 'Otra' }),
      );
      expect(t.users.all()[0]?.company).toBe('Otra');
    });
  });

  describe('role', () => {
    it('is RECRUITER for anyone but the configured administrator', async () => {
      const t = setup();
      await verify(t, await t.issueLink({ email: 'recruiter@example.test' }));
      expect(t.users.all()[0]?.role).toBe('RECRUITER');
    });

    it('is ADMIN for the configured email, ignoring case and spaces', async () => {
      const t = setup({ adminEmail: ' Admin@Example.test ' });
      await verify(t, await t.issueLink({ email: 'ADMIN@example.test' }));
      expect(t.users.all()[0]?.role).toBe('ADMIN');
      expect(t.issuer.issued[0]?.claims.role).toBe('ADMIN');
    });

    it('is recomputed at every login: a former administrator is a recruiter again', async () => {
      const first = setup({ adminEmail: 'admin@example.test' });
      await verify(
        first,
        await first.issueLink({ email: 'admin@example.test' }),
      );
      expect(first.users.all()[0]?.role).toBe('ADMIN');

      const t = setup({ adminEmail: 'someone-else@example.test' });
      await t.users.upsertOnLogin(
        {
          email: Email.parse('admin@example.test'),
          role: 'ADMIN',
          company: null,
          name: null,
        },
        NOW,
      );
      await verify(t, await t.issueLink({ email: 'admin@example.test' }));
      expect(t.users.all()[0]?.role).toBe('RECRUITER');
      expect(t.issuer.issued[0]?.claims.role).toBe('RECRUITER');
    });

    it('is not raised by extra fields smuggled into the stored payload', async () => {
      const t = setup();
      const token = await t.issueLink({
        email: 'recruiter@example.test',
        role: 'ADMIN',
      } as MagicLinkPayload);
      await verify(t, token);
      expect(t.users.all()[0]?.role).toBe('RECRUITER');
    });
  });

  describe('an unusable link', () => {
    it('cannot be used twice', async () => {
      const t = setup();
      const token = await t.issueLink({ email: 'a@example.test' });
      await verify(t, token);
      await expect(verify(t, token)).rejects.toBeInstanceOf(InvalidMagicLink);
      expect(t.refresh.all()).toHaveLength(1);
      expect(t.issuer.issued).toHaveLength(1);
    });

    it('expires after 900 seconds, and not before', async () => {
      const t = setup();
      const early = await t.issueLink({ email: 'a@example.test' });
      const late = await t.issueLink({ email: 'b@example.test' });
      t.clock.advanceSeconds(899);
      await expect(verify(t, early)).resolves.toBeDefined();
      t.clock.advanceSeconds(1);
      await expect(verify(t, late)).rejects.toBeInstanceOf(InvalidMagicLink);
    });

    it('is refused when it was never issued', async () => {
      const t = setup();
      await expect(verify(t, 'N'.repeat(43))).rejects.toBeInstanceOf(
        InvalidMagicLink,
      );
      expect(t.users.all()).toHaveLength(0);
    });

    it.each([
      ['garbage', 'basura'],
      ['missing', undefined],
      ['not text', 42],
    ])('is refused as malformed when it is %s', async (_label, token) => {
      const t = setup();
      const failure = await verify(t, token).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(MalformedToken);
      expect(failure).toBeInstanceOf(InvalidInput);
    });

    it('lets exactly one of two simultaneous verifications win', async () => {
      const t = setup();
      const token = await t.issueLink({ email: 'a@example.test' });
      const results = await Promise.allSettled([
        verify(t, token),
        verify(t, token),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect(rejected?.reason).toBeInstanceOf(InvalidMagicLink);
      expect(t.refresh.all()).toHaveLength(1);
      expect(t.users.all()).toHaveLength(1);
    });
  });

  describe('per-IP limit', () => {
    it('raises RateLimited over the limit and leaves the link usable', async () => {
      const t = setup({ ipRule: { limit: 2, windowSeconds: 300 } });
      const token = await t.issueLink({ email: 'a@example.test' });
      await expect(verify(t, 'G'.repeat(43))).rejects.toBeInstanceOf(
        InvalidMagicLink,
      );
      await expect(verify(t, 'H'.repeat(43))).rejects.toBeInstanceOf(
        InvalidMagicLink,
      );
      const failure = await verify(t, token).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(RateLimited);
      expect((failure as RateLimited).retryAfterSeconds).toBe(300);
      // The refused attempt did not burn the link (shorter window than its TTL).
      t.clock.advanceSeconds(300);
      await expect(verify(t, token)).resolves.toBeDefined();
    });

    it('does not affect another IP', async () => {
      const t = setup({ ipRule: { limit: 1, windowSeconds: 900 } });
      await verify(t, 'G'.repeat(43)).catch(() => undefined);
      const token = await t.issueLink({ email: 'a@example.test' });
      await expect(verify(t, token, '203.0.113.2')).resolves.toBeDefined();
    });
  });

  describe('when a store is down (fail closed)', () => {
    const down = new InfrastructureUnavailable(new Error('ECONNREFUSED'));

    it('opens no session when the link store fails', async () => {
      const t = setup(
        {},
        {
          store: {
            save: () => Promise.resolve(),
            consume: () => Promise.reject(down),
          },
        },
      );
      await expect(verify(t, 'T'.repeat(43))).rejects.toBe(down);
      expect(t.users.all()).toHaveLength(0);
      expect(t.refresh.all()).toHaveLength(0);
    });

    it('opens no session when the rate limiter fails', async () => {
      const t = setup({}, { limiter: { hit: () => Promise.reject(down) } });
      const token = await t.issueLink({ email: 'a@example.test' });
      await expect(verify(t, token)).rejects.toBe(down);
      expect(t.issuer.issued).toHaveLength(0);
    });

    it('opens no session when the user store fails', async () => {
      const t = setup(
        {},
        {
          users: {
            upsertOnLogin: () => Promise.reject(down),
            findById: () => Promise.resolve(null),
          },
        },
      );
      const token = await t.issueLink({ email: 'a@example.test' });
      await expect(verify(t, token)).rejects.toBe(down);
      expect(t.refresh.all()).toHaveLength(0);
      expect(t.issuer.issued).toHaveLength(0);
    });
  });
});
