import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../identity/application/ports/user-repository.port';
import { AdminPolicy } from '../../identity/domain/admin-policy';
import { Email } from '../../identity/domain/email';
import { optionalProfileText } from '../../identity/domain/user';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/ports/id-generator.port';
import {
  RANDOM_SOURCE,
  type RandomSource,
} from '../../shared/application/ports/random-source.port';
import { RateLimited } from '../../shared/domain/errors';
import { sha256Hex } from '../../shared/domain/hash';
import { InvalidMagicLink } from '../domain/auth-errors';
import { MagicLinkToken } from '../domain/magic-link-token';
import { generateOpaqueToken } from '../domain/opaque-token';
import { ipRateLimitKey } from '../domain/rate-limit-key';
import { SessionPolicy } from '../domain/session-policy';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from './ports/access-token.port';
import {
  MAGIC_LINK_STORE,
  type MagicLinkStore,
} from './ports/magic-link-store.port';
import { RATE_LIMITER, type RateLimiter } from './ports/rate-limiter.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './ports/refresh-token-repository.port';

export interface VerifyMagicLinkOptions {
  readonly adminEmail: string;
  readonly ipRule: { readonly limit: number; readonly windowSeconds: number };
}

export const VERIFY_MAGIC_LINK_OPTIONS = Symbol('VERIFY_MAGIC_LINK_OPTIONS');

export interface VerifyMagicLinkInput {
  readonly token: unknown;
  readonly ip: string;
}

/** What the HTTP layer turns into cookies. */
export interface IssuedSession {
  readonly accessJwt: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

@Injectable()
export class VerifyMagicLink {
  constructor(
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(MAGIC_LINK_STORE) private readonly store: MagicLinkStore,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refresh: RefreshTokenRepository,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly issuer: AccessTokenIssuer,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(VERIFY_MAGIC_LINK_OPTIONS)
    private readonly options: VerifyMagicLinkOptions,
  ) {}

  async execute(input: VerifyMagicLinkInput): Promise<IssuedSession> {
    const token = MagicLinkToken.parse(input.token);
    // Every attempt counts, guesses included; a refused one burns nothing.
    const byIp = await this.limiter.hit(
      ipRateLimitKey('vf:ip', input.ip, this.options.ipRule),
    );
    if (!byIp.allowed) throw new RateLimited(byIp.retryAfterSeconds);

    // Atomic read-and-delete: unknown, expired and used all look the same.
    const payload = await this.store.consume(token.hash);
    if (payload === null) throw new InvalidMagicLink();

    const now = this.clock.now();
    const email = Email.parse(payload.email);
    const user = await this.users.upsertOnLogin(
      {
        email,
        // Only the configured address is ADMIN; nothing in the payload counts.
        role: AdminPolicy.roleFor(email, this.options.adminEmail),
        company: optionalProfileText(payload.company, 'company'),
        name: optionalProfileText(payload.name, 'name'),
      },
      now,
    );

    const refreshToken = generateOpaqueToken(this.random);
    const refreshExpiresAt = SessionPolicy.sessionExpiresAt(now);
    await this.refresh.create({
      userId: user.id,
      familyId: this.ids.uuid(),
      tokenHash: sha256Hex(refreshToken),
      expiresAt: refreshExpiresAt,
    });
    const accessJwt = await this.issuer.issue(
      { sub: user.id, role: user.role },
      now,
    );
    return { accessJwt, refreshToken, refreshExpiresAt };
  }
}
