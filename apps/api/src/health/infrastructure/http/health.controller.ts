import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CheckHealth } from '../../application/check-health.use-case';
import { HealthReport } from '../../domain/health-report';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(CheckHealth) private readonly checkHealth: CheckHealth) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: HealthResponseDto })
  check(): Promise<HealthReport> {
    return this.checkHealth.execute();
  }
}
