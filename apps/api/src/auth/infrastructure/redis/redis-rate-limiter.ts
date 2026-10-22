import type { Redis } from 'ioredis';
import { InfrastructureUnavailable } from '../../../shared/domain/errors';
import { sha256Hex } from '../../../shared/domain/hash';
import type {
  RateLimiter,
  RateLimitResult,
} from '../../application/ports/rate-limiter.port';
import type { RateLimitKey } from '../../domain/rate-limit-key';
import { withRedis } from './redis-errors';

/**
 * Fixed window per key: `SET 0 EX NX` opens the window once, `INCR` counts,
 * `TTL` says when it closes. One MULTI, so a counter never exists without an
 * expiry. Works on Upstash too (no Lua, no `EXPIRE ... NX`). The key holds a
 * hash, never the IP or the email.
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async hit(key: RateLimitKey): Promise<RateLimitResult> {
    const redisKey = `rl:${key.scope}:${sha256Hex(key.subject)}`;
    const replies = await withRedis(() =>
      this.redis
        .multi()
        .set(redisKey, 0, 'EX', key.windowSeconds, 'NX')
        .incr(redisKey)
        .ttl(redisKey)
        .exec(),
    );
    const count = replies?.[1]?.[1];
    const ttl = replies?.[2]?.[1];
    if (typeof count !== 'number' || typeof ttl !== 'number') {
      throw new InfrastructureUnavailable(
        new Error('Unexpected reply from the rate limiter'),
      );
    }
    return {
      allowed: count <= key.limit,
      // TTL is -1 only if the expiry is lost; waiting a full window is the safe answer.
      retryAfterSeconds: ttl > 0 ? ttl : key.windowSeconds,
    };
  }
}
