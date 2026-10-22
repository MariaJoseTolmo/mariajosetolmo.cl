import { Controller, Get, Inject } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal } from '../../../shared/infrastructure/http/principal.decorator';
import { GetMe, type Me } from '../../application/get-me.use-case';
import type { Principal } from '../../domain/principal';
import { MeResponseDto } from './me-response.dto';

@ApiTags('me')
@ApiCookieAuth('access-cookie')
@Controller('v1/me')
export class MeController {
  constructor(@Inject(GetMe) private readonly getMe: GetMe) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentPrincipal() principal: Principal): Promise<Me> {
    return this.getMe.execute(principal);
  }
}
