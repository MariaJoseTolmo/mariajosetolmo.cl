import type { Clock } from '../../../shared/application/ports/clock.port';
import type {
  RateLimiter,
  RateLimitResult,
} from '../../application/ports/rate-limiter.port';
import type { RateLimitKey } from '../../domain/rate-limit-key';

interface Window {
  count: number;
  readonly endsAt: number;
}

/** Test double with the same fixed-window contract as the Redis limiter. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly clock: Clock) {}

  hit(key: RateLimitKey): Promise<RateLimitResult> {
    const now = this.clock.now().getTime();
    const id = `${key.scope}:${key.subject}`;
    let window = this.windows.get(id);
    if (!window || window.endsAt <= now) {
      window = { count: 0, endsAt: now + key.windowSeconds * 1000 };
      this.windows.set(id, window);
    }
    window.count += 1;
    return Promise.resolve({
      allowed: window.count <= key.limit,
      retryAfterSeconds: Math.ceil((window.endsAt - now) / 1000),
    });
  }
}
