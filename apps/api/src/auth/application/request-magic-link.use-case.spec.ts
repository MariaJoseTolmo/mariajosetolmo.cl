import { CapturingLogger } from '../../../test/support/fakes/capturing-logger';
import { CapturingMailSender } from '../../../test/support/fakes/capturing-mail-sender';
import { FakeClock } from '../../../test/support/fakes/fake-clock';
import {
  InMemoryMagicLinkStore,
  InMemoryRateLimiter,
} from '../../../test/support/fakes/in-memory-auth-stores';
import { SequenceRandomSource } from '../../../test/support/fakes/sequence-random';
import {
  InfrastructureUnavailable,
  InvalidInput,
  RateLimited,
} from '../../shared/domain/errors';
import { sha256Hex } from '../../shared/domain/hash';
import type { MagicLinkStore } from './ports/magic-link-store.port';
import type { RateLimiter } from './ports/rate-limiter.port';
import {
  RequestMagicLink,
  type RequestMagicLinkOptions,
} from './request-magic-link.use-case';

const BASE_URL = 'https://app.example.test/acceso/verificar/';

interface Setup {
  useCase: RequestMagicLink;
  mail: CapturingMailSender;
  store: InMemoryMagicLinkStore;
  logger: CapturingLogger;
  clock: FakeClock;
}

function setup(
  options: Partial<RequestMagicLinkOptions> = {},
  overrides: { store?: MagicLinkStore; limiter?: RateLimiter } = {},
): Setup {
  const clock = new FakeClock();
  const store = new InMemoryMagicLinkStore(clock);
  const mail = new CapturingMailSender();
  const logger = new CapturingLogger();
  const useCase = new RequestMagicLink(
    overrides.limiter ?? new InMemoryRateLimiter(clock),
    new SequenceRandomSource(),
    overrides.store ?? store,
    mail,
    logger,
    {
      baseUrl: BASE_URL,
      ipRule: { limit: 10, windowSeconds: 900 },
      emailRule: { limit: 3, windowSeconds: 900 },
      ...options,
    },
  );
  return { useCase, mail, store, logger, clock };
}

const ask = (
  t: Setup,
  email: unknown,
  ip = '203.0.113.1',
  extra: { company?: unknown; name?: unknown } = {},
): Promise<void> => t.useCase.execute({ email, ip, ...extra });

describe('RequestMagicLink', () => {
  it('does the same work for any valid email: one stored hash, one message each', async () => {
    const t = setup();
    await ask(t, 'known@example.test');
    await ask(t, 'new@example.test');
    expect(t.mail.sent.map((m) => m.to)).toEqual([
      'known@example.test',
      'new@example.test',
    ]);
    expect(t.store.entries()).toHaveLength(2);
    for (const entry of t.store.entries()) expect(entry.ttlSeconds).toBe(900);
  });

  it('normalises the email before using it', async () => {
    const t = setup();
    await ask(t, '  New@Example.TEST ');
    expect(t.mail.sent[0]?.to).toBe('new@example.test');
    expect(t.store.entries()[0]?.payload).toEqual({
      email: 'new@example.test',
    });
  });

  it('stores only the hash: the clear token appears nowhere in the store', async () => {
    const t = setup();
    await ask(t, 'a@example.test');
    const token = t.mail.lastToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const entries = t.store.entries();
    expect(entries.map((e) => e.key)).toEqual([sha256Hex(token)]);
    expect(JSON.stringify(entries)).not.toContain(token);
  });

  it('puts the token in the link fragment, never in the query', async () => {
    const t = setup();
    await ask(t, 'a@example.test');
    const link = t.mail.sent[0]?.link ?? '';
    expect(link).toMatch(
      /^https:\/\/app\.example\.test\/acceso\/verificar\/#token=[A-Za-z0-9_-]{43}$/,
    );
    expect(link).not.toContain('?token=');
  });

  it('gives each request its own token', async () => {
    const t = setup();
    await ask(t, 'a@example.test');
    const first = t.mail.lastToken();
    await ask(t, 'b@example.test');
    expect(t.mail.lastToken()).not.toBe(first);
  });

  describe('company and name', () => {
    it('travel in the payload, trimmed, only when present', async () => {
      const t = setup();
      await ask(t, 'a@example.test', '203.0.113.1', {
        company: '  Acme ',
        name: 'Ana',
      });
      await ask(t, 'b@example.test', '203.0.113.1', { company: '   ' });
      expect(t.store.entries().map((e) => e.payload)).toEqual([
        { email: 'a@example.test', company: 'Acme', name: 'Ana' },
        { email: 'b@example.test' },
      ]);
    });

    it.each([
      ['company too long', { company: 'x'.repeat(121) }],
      ['name with a control character', { name: 'Ana\u0000' }],
      ['company that is not text', { company: 42 }],
    ])('rejects %s', async (_label, extra) => {
      const t = setup();
      await expect(
        ask(t, 'a@example.test', '203.0.113.1', extra),
      ).rejects.toBeInstanceOf(InvalidInput);
      expect(t.mail.sent).toHaveLength(0);
      expect(t.store.entries()).toHaveLength(0);
    });
  });

  describe('invalid email', () => {
    it.each([
      ['not an address', 'no-es-correo'],
      ['empty', ''],
      ['missing', undefined],
      ['not text', { email: 'a@example.test' }],
    ])('%s: 400 and nothing is stored or sent', async (_label, email) => {
      const t = setup();
      await expect(ask(t, email)).rejects.toBeInstanceOf(InvalidInput);
      expect(t.mail.sent).toHaveLength(0);
      expect(t.store.entries()).toHaveLength(0);
    });
  });

  describe('per-IP limit', () => {
    it('is visible: the request over the limit raises RateLimited with the wait', async () => {
      const t = setup({ ipRule: { limit: 2, windowSeconds: 900 } });
      await ask(t, 'a@example.test');
      t.clock.advanceSeconds(100);
      await ask(t, 'b@example.test');
      const failure = await ask(t, 'c@example.test').catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(RateLimited);
      expect((failure as RateLimited).retryAfterSeconds).toBe(800);
      expect(t.mail.sent).toHaveLength(2);
    });

    it('is per address: another IP is not affected', async () => {
      const t = setup({ ipRule: { limit: 1, windowSeconds: 900 } });
      await ask(t, 'a@example.test', '203.0.113.1');
      await ask(t, 'b@example.test', '203.0.113.2');
      expect(t.mail.sent).toHaveLength(2);
    });

    it('groups an IPv6 /64 as one address', async () => {
      const t = setup({ ipRule: { limit: 1, windowSeconds: 900 } });
      await ask(t, 'a@example.test', '2001:db8:1:2::1');
      await expect(
        ask(t, 'b@example.test', '2001:db8:1:2:ffff::9'),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('does not spend the email budget when it refuses', async () => {
      const t = setup({
        ipRule: { limit: 1, windowSeconds: 900 },
        emailRule: { limit: 2, windowSeconds: 900 },
      });
      await ask(t, 'x@example.test', '203.0.113.1');
      await expect(
        ask(t, 'x@example.test', '203.0.113.1'),
      ).rejects.toBeInstanceOf(RateLimited);
      await ask(t, 'x@example.test', '203.0.113.2');
      expect(t.mail.sent).toHaveLength(2);
    });
  });

  describe('per-email limit', () => {
    it('is silent: it resolves like a success but sends nothing more', async () => {
      const t = setup({ emailRule: { limit: 3, windowSeconds: 900 } });
      for (let i = 1; i <= 4; i++) {
        await expect(
          ask(t, 'same@example.test', `203.0.113.${i}`),
        ).resolves.toBeUndefined();
      }
      expect(t.mail.sent).toHaveLength(3);
      expect(t.store.entries()).toHaveLength(3);
    });

    it('counts the email once normalised', async () => {
      const t = setup({ emailRule: { limit: 1, windowSeconds: 900 } });
      await ask(t, 'Same@Example.test', '203.0.113.1');
      await ask(t, ' same@example.test ', '203.0.113.2');
      expect(t.mail.sent).toHaveLength(1);
    });
  });

  describe('when the email cannot be delivered', () => {
    it('still resolves, logs the failure, and the token was stored', async () => {
      const t = setup();
      t.mail.failWith = new Error('554 rejected a@example.test');
      await expect(ask(t, 'a@example.test')).resolves.toBeUndefined();
      expect(t.logger.errors).toHaveLength(1);
      expect(t.store.entries()).toHaveLength(1);
    });

    it('names the provider error code when there is one, never its text', async () => {
      const t = setup();
      t.mail.failWith = Object.assign(
        new Error('550 rejected a@example.test'),
        {
          code: 'EENVELOPE',
        },
      );
      await ask(t, 'a@example.test');
      expect(t.logger.errors).toEqual([
        'Magic link email failed: Error EENVELOPE',
      ]);
    });

    it('survives a provider that rejects with something that is not an Error', async () => {
      const t = setup();
      t.mail.failWith = 'plain text' as unknown as Error;
      await expect(ask(t, 'a@example.test')).resolves.toBeUndefined();
      expect(t.logger.errors).toEqual([
        'Magic link email failed: unknown error',
      ]);
    });

    it('logs no address and no token', async () => {
      const t = setup();
      t.mail.failWith = new Error('554 rejected a@example.test');
      await ask(t, 'a@example.test');
      const logged = t.logger.errors.join('\n');
      expect(logged).toContain('Magic link email failed');
      expect(logged).not.toContain('a@example.test');
      expect(logged).not.toMatch(/[A-Za-z0-9_-]{43}/);
    });
  });

  describe('when a store is down (fail closed)', () => {
    const down = new InfrastructureUnavailable(new Error('ECONNREFUSED'));

    it('does not send when the rate limiter is unavailable', async () => {
      const t = setup({}, { limiter: { hit: () => Promise.reject(down) } });
      await expect(ask(t, 'a@example.test')).rejects.toBe(down);
      expect(t.mail.sent).toHaveLength(0);
    });

    it('does not send when the link cannot be stored', async () => {
      const t = setup(
        {},
        {
          store: {
            save: () => Promise.reject(down),
            consume: () => Promise.resolve(null),
          },
        },
      );
      await expect(ask(t, 'a@example.test')).rejects.toBe(down);
      expect(t.mail.sent).toHaveLength(0);
    });
  });
});
