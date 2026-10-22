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
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CLOCK,
  type Clock,
} from '../../../shared/application/ports/clock.port';
import { Public } from '../../../shared/infrastructure/http/public.decorator';
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
import { SessionCookieWriter } from './session-cookie.writer';

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(RequestMagicLink)
    private readonly requestMagicLink: RequestMagicLink,
    @Inject(VerifyMagicLink) private readonly verifyMagicLink: VerifyMagicLink,
    @Inject(CLIENT_IP_RESOLVER) private readonly clientIp: ClientIpResolver,
    @Inject(SessionCookieWriter) private readonly cookies: SessionCookieWriter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

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
}
