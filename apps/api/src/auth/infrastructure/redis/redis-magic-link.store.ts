import type { Redis } from 'ioredis';
import type {
  MagicLinkPayload,
  MagicLinkStore,
} from '../../application/ports/magic-link-store.port';
import { withRedis } from './redis-errors';

const KEY_PREFIX = 'ml:tok:';

/** Only the known fields survive, whatever else the stored JSON carries. */
function toPayload(value: unknown): MagicLinkPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const { email, company, name } = value as Record<string, unknown>;
  if (typeof email !== 'string') return null;
  if (company !== undefined && typeof company !== 'string') return null;
  if (name !== undefined && typeof name !== 'string') return null;
  return {
    email,
    ...(company !== undefined && { company }),
    ...(name !== undefined && { name }),
  };
}

/** Magic links in Redis: `SET NX EX` to save, `GETDEL` to consume exactly once. */
export class RedisMagicLinkStore implements MagicLinkStore {
  constructor(private readonly redis: Redis) {}

  save(
    tokenHash: string,
    payload: MagicLinkPayload,
    ttlSeconds: number,
  ): Promise<void> {
    return withRedis(async () => {
      const stored = await this.redis.set(
        KEY_PREFIX + tokenHash,
        JSON.stringify(payload),
        'EX',
        ttlSeconds,
        'NX',
      );
      // NX refuses a live key: with 256-bit tokens that is a bug, not a collision.
      if (stored !== 'OK') throw new Error('Magic link key already exists');
    });
  }

  async consume(tokenHash: string): Promise<MagicLinkPayload | null> {
    const raw = await withRedis(() =>
      this.redis.getdel(KEY_PREFIX + tokenHash),
    );
    if (raw === null) return null;
    try {
      return toPayload(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}
