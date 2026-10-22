import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { sha256Hex } from '../../src/shared/domain/hash';
import { RedisMagicLinkStore } from '../../src/auth/infrastructure/redis/redis-magic-link.store';
import { createRedisClient } from '../../src/shared/infrastructure/redis/redis-client.factory';
import { redisUrl } from './support/env';

describe('RedisMagicLinkStore (real Redis)', () => {
  let redis: Redis;
  let store: RedisMagicLinkStore;
  const created: string[] = [];

  /** A fresh token and its hash; the hash is what the store sees. */
  const newToken = (): { token: string; hash: string } => {
    const token = randomBytes(32).toString('base64url');
    const hash = sha256Hex(token);
    created.push(hash);
    return { token, hash };
  };

  beforeAll(() => {
    redis = createRedisClient(redisUrl());
    store = new RedisMagicLinkStore(redis);
  });
  afterEach(async () => {
    // Only this suite's keys: the Redis may be the developer's own.
    if (created.length > 0) {
      await redis.del(...created.splice(0).map((hash) => `ml:tok:${hash}`));
    }
  });
  afterAll(() => {
    redis.disconnect();
  });

  it('saves under the hash with a 900 s TTL and consumes it once', async () => {
    const { hash } = newToken();
    await store.save(hash, { email: 'a@example.test', company: 'Acme' }, 900);
    const ttl = await redis.ttl(`ml:tok:${hash}`);
    expect(ttl).toBeGreaterThan(895);
    expect(ttl).toBeLessThanOrEqual(900);
    await expect(store.consume(hash)).resolves.toEqual({
      email: 'a@example.test',
      company: 'Acme',
    });
    await expect(store.consume(hash)).resolves.toBeNull();
    await expect(redis.exists(`ml:tok:${hash}`)).resolves.toBe(0);
  });

  it('returns null for a hash that was never saved', async () => {
    await expect(store.consume(newToken().hash)).resolves.toBeNull();
  });

  it('keeps the clear token out of every key and value it writes', async () => {
    const { token, hash } = newToken();
    await store.save(hash, { email: 'b@example.test', name: 'Ana' }, 900);
    const key = `ml:tok:${hash}`;
    expect(key).not.toContain(token);
    const raw = await redis.get(key);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(token);
    expect(JSON.parse(raw ?? '')).toEqual({
      email: 'b@example.test',
      name: 'Ana',
    });
  });

  it('expires after the TTL', async () => {
    const { hash } = newToken();
    await store.save(hash, { email: 'c@example.test' }, 1);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await expect(store.consume(hash)).resolves.toBeNull();
  });

  it('lets exactly one of many concurrent consumers win', async () => {
    const { hash } = newToken();
    await store.save(hash, { email: 'd@example.test' }, 900);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.consume(hash)),
    );
    const winners = results.filter((payload) => payload !== null);
    expect(winners).toEqual([{ email: 'd@example.test' }]);
  });

  it('treats a corrupted value as an invalid link, and still removes it', async () => {
    const { hash } = newToken();
    await redis.set(`ml:tok:${hash}`, 'not json', 'EX', 60);
    await expect(store.consume(hash)).resolves.toBeNull();
    await expect(redis.exists(`ml:tok:${hash}`)).resolves.toBe(0);
  });

  it('refuses to overwrite a live key', async () => {
    const { hash } = newToken();
    await store.save(hash, { email: 'e@example.test' }, 900);
    await expect(
      store.save(hash, { email: 'other@example.test' }, 900),
    ).rejects.toThrow();
    await expect(store.consume(hash)).resolves.toEqual({
      email: 'e@example.test',
    });
  });

  it('fails closed with InfrastructureUnavailable when Redis is unreachable', async () => {
    const down = createRedisClient('redis://127.0.0.1:1');
    down.on('error', () => undefined);
    const broken = new RedisMagicLinkStore(down);
    try {
      await expect(
        broken.save(newToken().hash, { email: 'f@example.test' }, 900),
      ).rejects.toBeInstanceOf(InfrastructureUnavailable);
      await expect(broken.consume(newToken().hash)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
    } finally {
      down.disconnect();
    }
  });
});
