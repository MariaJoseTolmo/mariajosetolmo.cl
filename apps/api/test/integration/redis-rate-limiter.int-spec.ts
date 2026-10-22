import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import {
  emailRateLimitKey,
  ipRateLimitKey,
  type RateLimitKey,
} from '../../src/auth/domain/rate-limit-key';
import { RedisRateLimiter } from '../../src/auth/infrastructure/redis/redis-rate-limiter';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { sha256Hex } from '../../src/shared/domain/hash';
import { createRedisClient } from '../../src/shared/infrastructure/redis/redis-client.factory';
import { redisUrl } from './support/env';

describe('RedisRateLimiter (real Redis)', () => {
  let redis: Redis;
  let limiter: RedisRateLimiter;
  const created: string[] = [];

  const redisKeyOf = (key: RateLimitKey): string =>
    `rl:${key.scope}:${sha256Hex(key.subject)}`;
  /** A key nobody else uses, remembered for cleanup. */
  const track = (key: RateLimitKey): RateLimitKey => {
    created.push(redisKeyOf(key));
    return key;
  };
  const unique = (): string => randomBytes(6).toString('hex');

  beforeAll(() => {
    redis = createRedisClient(redisUrl());
    limiter = new RedisRateLimiter(redis);
  });
  afterEach(async () => {
    if (created.length > 0) await redis.del(...created.splice(0));
  });
  afterAll(() => {
    redis.disconnect();
  });

  it('allows up to the limit and denies the next attempt with a retry time', async () => {
    const key = track(
      emailRateLimitKey(`${unique()}@example.test`, {
        limit: 3,
        windowSeconds: 900,
      }),
    );
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.hit(key));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    const denied = results[3];
    expect(denied?.retryAfterSeconds).toBeGreaterThan(895);
    expect(denied?.retryAfterSeconds).toBeLessThanOrEqual(900);
  });

  it('counts each subject on its own', async () => {
    const rule = { limit: 1, windowSeconds: 900 };
    const a = track(emailRateLimitKey(`${unique()}@example.test`, rule));
    const b = track(emailRateLimitKey(`${unique()}@example.test`, rule));
    await expect(limiter.hit(a)).resolves.toMatchObject({ allowed: true });
    await expect(limiter.hit(a)).resolves.toMatchObject({ allowed: false });
    await expect(limiter.hit(b)).resolves.toMatchObject({ allowed: true });
  });

  it('opens a new window once the old one has passed', async () => {
    const key = track(
      emailRateLimitKey(`${unique()}@example.test`, {
        limit: 1,
        windowSeconds: 1,
      }),
    );
    await limiter.hit(key);
    await expect(limiter.hit(key)).resolves.toMatchObject({ allowed: false });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await expect(limiter.hit(key)).resolves.toMatchObject({ allowed: true });
  });

  it('never leaves a counter without an expiry, and stores no clear subject', async () => {
    const email = `${unique()}@example.test`;
    const key = track(
      emailRateLimitKey(email, { limit: 3, windowSeconds: 900 }),
    );
    await limiter.hit(key);
    const redisKey = redisKeyOf(key);
    await expect(redis.ttl(redisKey)).resolves.toBeGreaterThan(0);
    expect(redisKey).not.toContain(email);
    const found = await redis.keys(`rl:ml:em:*${email.slice(0, 8)}*`);
    expect(found).toEqual([]);
  });

  it('shares one counter across a whole IPv6 /64', async () => {
    const rule = { limit: 2, windowSeconds: 900 };
    const prefix = `2001:db8:${unique().slice(0, 4)}:${unique().slice(0, 4)}`;
    const first = track(ipRateLimitKey('ml:ip', `${prefix}::1`, rule));
    const second = track(ipRateLimitKey('ml:ip', `${prefix}:0:0:0:99`, rule));
    const neighbour = track(
      ipRateLimitKey('ml:ip', `${prefix.slice(0, -1)}f::1`, rule),
    );
    expect(redisKeyOf(first)).toBe(redisKeyOf(second));
    await limiter.hit(first);
    await limiter.hit(second);
    await expect(limiter.hit(first)).resolves.toMatchObject({ allowed: false });
    await expect(limiter.hit(neighbour)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it('counts concurrent attempts exactly', async () => {
    const key = track(
      emailRateLimitKey(`${unique()}@example.test`, {
        limit: 5,
        windowSeconds: 900,
      }),
    );
    const results = await Promise.all(
      Array.from({ length: 20 }, () => limiter.hit(key)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it('fails closed with InfrastructureUnavailable when Redis is unreachable', async () => {
    const down = createRedisClient('redis://127.0.0.1:1');
    down.on('error', () => undefined);
    try {
      await expect(
        new RedisRateLimiter(down).hit(
          emailRateLimitKey('g@example.test', { limit: 1, windowSeconds: 60 }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureUnavailable);
    } finally {
      down.disconnect();
    }
  });
});
