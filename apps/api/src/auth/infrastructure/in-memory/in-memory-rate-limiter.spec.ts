import { FakeClock } from '../../../../test/support/fakes/fake-clock';
import { emailRateLimitKey } from '../../domain/rate-limit-key';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  const rule = { limit: 2, windowSeconds: 900 };
  const setup = (): { clock: FakeClock; limiter: InMemoryRateLimiter } => {
    const clock = new FakeClock();
    return { clock, limiter: new InMemoryRateLimiter(clock) };
  };

  it('allows the limit and denies the next hit with the time left', async () => {
    const { clock, limiter } = setup();
    const key = emailRateLimitKey('a@example.test', rule);
    await limiter.hit(key);
    clock.advanceSeconds(100);
    await expect(limiter.hit(key)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 800,
    });
    await expect(limiter.hit(key)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 800,
    });
  });

  it('opens a new window after the old one ends', async () => {
    const { clock, limiter } = setup();
    const key = emailRateLimitKey('a@example.test', { ...rule, limit: 1 });
    await limiter.hit(key);
    await expect(limiter.hit(key)).resolves.toMatchObject({ allowed: false });
    clock.advanceSeconds(900);
    await expect(limiter.hit(key)).resolves.toMatchObject({ allowed: true });
  });

  it('counts subjects and scopes separately', async () => {
    const { limiter } = setup();
    const one = { ...rule, limit: 1 };
    await limiter.hit(emailRateLimitKey('a@example.test', one));
    await expect(
      limiter.hit(emailRateLimitKey('b@example.test', one)),
    ).resolves.toMatchObject({ allowed: true });
    await expect(
      limiter.hit({
        ...emailRateLimitKey('a@example.test', one),
        scope: 'ml:ip',
      }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
