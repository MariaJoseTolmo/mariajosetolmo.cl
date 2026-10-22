import { Controller, Get, Inject } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCvLink, type CvLink } from '../../application/get-cv-link.use-case';
import { CvLinkResponseDto } from './cv-link-response.dto';

@ApiTags('cv')
@ApiCookieAuth('access-cookie')
@Controller('v1/cv')
export class CvController {
  constructor(@Inject(GetCvLink) private readonly getCvLink: GetCvLink) {}

  @Get()
  @ApiOkResponse({ type: CvLinkResponseDto })
  cv(): Promise<CvLink> {
    return this.getCvLink.execute();
  }
}
