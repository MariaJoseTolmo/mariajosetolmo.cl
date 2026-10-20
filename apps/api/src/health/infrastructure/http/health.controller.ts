import { Controller, Get, Header, Inject } from '@nestjs/common';
import { CheckHealth } from '../../application/check-health.use-case';
import { HealthReport } from '../../domain/health-report';

@Controller('health')
export class HealthController {
  constructor(@Inject(CheckHealth) private readonly checkHealth: CheckHealth) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  check(): Promise<HealthReport> {
    return this.checkHealth.execute();
  }
}
