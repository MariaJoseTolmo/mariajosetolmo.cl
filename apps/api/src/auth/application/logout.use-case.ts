import { Inject, Injectable } from '@nestjs/common';
import { describeFailure } from '../../shared/application/describe-failure';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  LOGGER,
  type Logger,
} from '../../shared/application/ports/logger.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './ports/refresh-token-repository.port';
import { RefreshToken } from '../domain/refresh-token';

export interface LogoutInput {
  readonly refreshToken: unknown;
}

/**
 * Ends the session if the token is known and says nothing otherwise: the
 * caller answers 204 and clears cookies in every case. A store failure is
 * logged (kind only) and swallowed; the access JWT lives out its 15 minutes
 * either way.
 */
@Injectable()
export class Logout {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refresh: RefreshTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const presented = RefreshToken.parse(input.refreshToken);
    if (presented === null) return;
    try {
      await this.refresh.revokeFamilyOf(presented.hash, this.clock.now());
    } catch (error) {
      this.logger.warn(
        `Logout could not revoke the session: ${describeFailure(error)}`,
      );
    }
  }
}
