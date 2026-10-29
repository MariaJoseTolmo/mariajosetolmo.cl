import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Unauthenticated } from '../../../../shared/domain/errors';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';
import {
  CLOCK,
  type Clock,
} from '../../../../shared/application/ports/clock.port';
import type { PrincipalRequest } from '../../../../shared/infrastructure/http/principal.decorator';
import { IS_PUBLIC_KEY } from '../../../../shared/infrastructure/http/public.decorator';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from '../../../application/ports/access-token.port';
import { cookieNamesFor } from '../cookie-names';

interface CookieRequest extends PrincipalRequest {
  readonly cookies?: Readonly<Record<string, string | undefined>>;
}

/** Deny by default: every route needs a valid access cookie unless @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly cookieName: string;

  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly verifier: AccessTokenVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.cookieName = cookieNamesFor(config.cookieSecure).access;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<CookieRequest>();
    const jwt = req.cookies?.[this.cookieName];
    const principal = jwt
      ? await this.verifier.verify(jwt, this.clock.now())
      : null;
    if (!principal) throw new Unauthenticated();
    req.principal = principal;
    return true;
  }
}
