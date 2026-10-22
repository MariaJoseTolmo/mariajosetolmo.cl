import type { RateLimitKey } from '../../domain/rate-limit-key';

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Seconds until the window resets; meaningful when `allowed` is false. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Counts one attempt and says whether it is within the limit. */
  hit(key: RateLimitKey): Promise<RateLimitResult>;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');
