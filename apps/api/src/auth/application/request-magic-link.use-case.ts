import { Inject, Injectable } from '@nestjs/common';
import { describeFailure } from '../../shared/application/describe-failure';
import { Email } from '../../identity/domain/email';
import { optionalProfileText } from '../../identity/domain/user';
import {
  LOGGER,
  type Logger,
} from '../../shared/application/ports/logger.port';
import {
  RANDOM_SOURCE,
  type RandomSource,
} from '../../shared/application/ports/random-source.port';
import { RateLimited } from '../../shared/domain/errors';
import { emailRateLimitKey, ipRateLimitKey } from '../domain/rate-limit-key';
import { MagicLinkToken, magicLinkUrl } from '../domain/magic-link-token';
import { SessionPolicy } from '../domain/session-policy';
import {
  MAGIC_LINK_STORE,
  type MagicLinkPayload,
  type MagicLinkStore,
} from './ports/magic-link-store.port';
import { MAIL_SENDER, type MailSender } from './ports/mail-sender.port';
import { RATE_LIMITER, type RateLimiter } from './ports/rate-limiter.port';

interface Rule {
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RequestMagicLinkOptions {
  readonly baseUrl: string;
  readonly ipRule: Rule;
  readonly emailRule: Rule;
}

export const REQUEST_MAGIC_LINK_OPTIONS = Symbol('REQUEST_MAGIC_LINK_OPTIONS');

export interface RequestMagicLinkInput {
  readonly email: unknown;
  readonly company?: unknown;
  readonly name?: unknown;
  readonly ip: string;
}

/**
 * Same work for every valid email, so the answer never says whether the
 * account exists: this use case does not even know a user store. The caller
 * answers 202 whenever it returns; only a bad input, the per-IP limit or a
 * down store make it throw.
 */
@Injectable()
export class RequestMagicLink {
  constructor(
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
    @Inject(MAGIC_LINK_STORE) private readonly store: MagicLinkStore,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(REQUEST_MAGIC_LINK_OPTIONS)
    private readonly options: RequestMagicLinkOptions,
  ) {}

  async execute(input: RequestMagicLinkInput): Promise<void> {
    const email = Email.parse(input.email);
    const company = optionalProfileText(input.company, 'company');
    const name = optionalProfileText(input.name, 'name');

    const byIp = await this.limiter.hit(
      ipRateLimitKey('ml:ip', input.ip, this.options.ipRule),
    );
    if (!byIp.allowed) throw new RateLimited(byIp.retryAfterSeconds);
    const byEmail = await this.limiter.hit(
      emailRateLimitKey(email.value, this.options.emailRule),
    );
    // Over the per-email budget: answer as if sent, send nothing.
    if (!byEmail.allowed) return;

    const token = MagicLinkToken.generate(this.random);
    const payload: MagicLinkPayload = {
      email: email.value,
      ...(company !== null && { company }),
      ...(name !== null && { name }),
    };
    await this.store.save(
      token.hash,
      payload,
      SessionPolicy.MAGIC_LINK_TTL_SECONDS,
    );
    await this.deliver(email, magicLinkUrl(this.options.baseUrl, token.value));
  }

  /** A provider failure must not change the answer (that would leak state). */
  private async deliver(to: Email, link: string): Promise<void> {
    try {
      await this.mail.sendMagicLink(to, link);
    } catch (error) {
      this.logger.error(`Magic link email failed: ${describeFailure(error)}`);
    }
  }
}
