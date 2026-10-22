import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../../config/app-config';
import {
  CLOCK,
  type Clock,
} from '../../../shared/application/ports/clock.port';
import { Unauthenticated } from '../../../shared/domain/errors';
import { Public } from '../../../shared/infrastructure/http/public.decorator';
import { Logout } from '../../application/logout.use-case';
import { RefreshSession } from '../../application/refresh-session.use-case';
import { RequestMagicLink } from '../../application/request-magic-link.use-case';
import { VerifyMagicLink } from '../../application/verify-magic-link.use-case';
import {
  CLIENT_IP_RESOLVER,
  type ClientIpResolver,
} from './client-ip.resolver';
import {
  AcceptedResponseDto,
  MagicLinkRequestDto,
  VerifyRequestDto,
} from './dto/magic-link-request.dto';
import { cookieNamesFor, type CookieNames } from './cookie-names';
import { SessionCookieWriter } from './session-cookie.writer';

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function cookieValue(req: Request, name: string): unknown {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  return cookies?.[name];
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  private readonly cookieNames: CookieNames;

  constructor(
    @Inject(RequestMagicLink)
    private readonly requestMagicLink: RequestMagicLink,
    @Inject(VerifyMagicLink) private readonly verifyMagicLink: VerifyMagicLink,
    @Inject(CLIENT_IP_RESOLVER) private readonly clientIp: ClientIpResolver,
    @Inject(SessionCookieWriter) private readonly cookies: SessionCookieWriter,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RefreshSession) private readonly refreshSession: RefreshSession,
    @Inject(Logout) private readonly logoutSession: Logout,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.cookieNames = cookieNamesFor(config.cookieSecure);
  }

  @Post('magic-link')
  @HttpCode(202)
  @ApiBody({ type: MagicLinkRequestDto })
  @ApiAcceptedResponse({ type: AcceptedResponseDto })
  async magicLink(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ status: 'accepted' }> {
    // Resolved first: a request that did not come through the CDN is a 403.
    const ip = this.clientIp.resolve(req);
    const { email, company, name } = asRecord(body);
    await this.requestMagicLink.execute({ email, company, name, ip });
    return { status: 'accepted' };
  }

  @Post('verify')
  @HttpCode(204)
  @ApiBody({ type: VerifyRequestDto })
  @ApiNoContentResponse({
    description: 'Session cookies are set (access and refresh).',
  })
  async verify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const ip = this.clientIp.resolve(req);
    const session = await this.verifyMagicLink.execute({
      token: asRecord(body)['token'],
      ip,
    });
    this.cookies.write(res, session, this.clock.now());
  }

  @Post('refresh')
  @HttpCode(204)
  @ApiNoContentResponse({
    description:
      'The refresh token rotated: new access and refresh cookies are set.',
  })
  @ApiUnauthorizedResponse({
    description:
      'No usable refresh cookie. The cookies are cleared, except when the token was spent a moment ago by a racing tab.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const ip = this.clientIp.resolve(req);
    const result = await this.refreshSession.execute({
      refreshToken: cookieValue(req, this.cookieNames.refresh),
      ip,
    });
    if (result.kind === 'issued') {
      this.cookies.write(res, result.session, this.clock.now());
      return;
    }
    if (result.clearCookies) this.cookies.clear(res);
    throw new Unauthenticated();
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({
    description:
      'Always, with or without a session: the refresh family is revoked if known and both cookies are cleared.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logoutSession.execute({
      refreshToken: cookieValue(req, this.cookieNames.refresh),
    });
    this.cookies.clear(res);
  }
}
