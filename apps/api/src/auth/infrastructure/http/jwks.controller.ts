import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/infrastructure/http/public.decorator';
import {
  JWKS_PROVIDER,
  type JwksProvider,
} from '../../application/ports/access-token.port';

@ApiTags('auth')
@Public()
@Controller('.well-known')
export class JwksController {
  constructor(@Inject(JWKS_PROVIDER) private readonly jwks: JwksProvider) {}

  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'Public signing keys (JWKS).' })
  keys(): { keys: unknown[] } {
    return this.jwks.jwks();
  }
}
