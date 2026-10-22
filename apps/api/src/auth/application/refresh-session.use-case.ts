import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../identity/application/ports/user-repository.port';
import { RateLimited } from '../../shared/domain/errors';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  RANDOM_SOURCE,
  type RandomSource,
} from '../../shared/application/ports/random-source.port';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from './ports/access-token.port';
import { RATE_LIMITER, type RateLimiter } from './ports/rate-limiter.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
  type RefreshTokenState,
} from './ports/refresh-token-repository.port';
import { ipRateLimitKey } from '../domain/rate-limit-key';
import { RefreshToken, judgeRefusedRefresh } from '../domain/refresh-token';
import type { IssuedSession } from './verify-magic-link.use-case';

export interface RefreshSessionOptions {
  readonly ipRule: { readonly limit: number; readonly windowSeconds: number };
}

export const REFRESH_SESSION_OPTIONS = Symbol('REFRESH_SESSION_OPTIONS');

export interface RefreshSessionInput {
  readonly refreshToken: unknown;
  readonly ip: string;
}

const REJECTED_AND_CLEARED = {
  kind: 'rejected',
  clearCookies: true,
} as const;

export type RefreshResult =
  | { readonly kind: 'issued'; readonly session: IssuedSession }
  | { readonly kind: 'rejected'; readonly clearCookies: boolean };

@Injectable()
export class RefreshSession {
  constructor(
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refresh: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly issuer: AccessTokenIssuer,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(REFRESH_SESSION_OPTIONS)
    private readonly options: RefreshSessionOptions,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshResult> {
    const presented = RefreshToken.parse(input.refreshToken);
    // Not a token at all: nothing to look up, nothing worth counting.
    if (presented === null) return REJECTED_AND_CLEARED;

    const byIp = await this.limiter.hit(
      ipRateLimitKey('rf:ip', input.ip, this.options.ipRule),
    );
    if (!byIp.allowed) throw new RateLimited(byIp.retryAfterSeconds);

    const now = this.clock.now();
    // Read first, mutate last: a failure here (or reading the user) leaves the
    // token unspent, so the client simply retries.
    const state = await this.refresh.findByHash(presented.hash);
    if (state === null || !isUsable(state, now)) {
      return this.judge(state, now);
    }
    const user = await this.users.findById(state.userId);
    if (user === null) {
      await this.refresh.revokeFamily(state.familyId, now);
      return REJECTED_AND_CLEARED;
    }

    // One atomic step: spend this token and store its successor, or neither.
    // Null means a racing request or a revocation got there first.
    const next = RefreshToken.generate(this.random);
    const rotated = await this.refresh.rotate(presented.hash, next.hash, now);
    if (rotated === null) {
      return this.judge(await this.refresh.findByHash(presented.hash), now);
    }

    const accessJwt = await this.issuer.issue(
      { sub: user.id, role: user.role },
      now,
    );
    return {
      kind: 'issued',
      session: {
        accessJwt,
        refreshToken: next.value,
        // Absolute: the family keeps the end date it got at login (design A8).
        refreshExpiresAt: rotated.expiresAt,
      },
    };
  }

  /** The token could not be rotated: always a 401, maybe a revocation. */
  private async judge(
    state: RefreshTokenState | null,
    now: Date,
  ): Promise<RefreshResult> {
    const outcome = judgeRefusedRefresh(state, now);
    if (outcome.revokeFamily && state !== null) {
      await this.refresh.revokeFamily(state.familyId, now);
    }
    return { kind: 'rejected', clearCookies: outcome.clearCookies };
  }
}

function isUsable(state: RefreshTokenState, now: Date): boolean {
  return (
    state.usedAt === null &&
    state.revokedAt === null &&
    state.expiresAt.getTime() > now.getTime()
  );
}
