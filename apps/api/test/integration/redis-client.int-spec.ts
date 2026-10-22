import type { Redis } from 'ioredis';
import { createRedisClient } from '../../src/shared/infrastructure/redis/redis-client.factory';
import { redisUrl } from './support/env';

describe('createRedisClient (real Redis)', () => {
  const open: Redis[] = [];
  const track = (client: Redis): Redis => {
    open.push(client);
    return client;
  };
  afterEach(() => {
    for (const client of open.splice(0)) client.disconnect();
  });

  it('does not connect at creation, and the first command connects', async () => {
    const client = track(createRedisClient(redisUrl()));
    expect(client.status).toBe('wait');
    await expect(client.ping()).resolves.toBe('PONG');
    expect(client.status).toBe('ready');
  });

  it('fails the command quickly when Redis is unreachable', async () => {
    // Port 1 on loopback refuses connections.
    const client = track(createRedisClient('redis://127.0.0.1:1'));
    client.on('error', () => undefined);
    const started = Date.now();
    await expect(client.ping()).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
