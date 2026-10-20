import { Module } from '@nestjs/common';
import { CheckHealth } from './application/check-health.use-case';
import { HEALTH_PROBES } from './application/ports/health-probe.port';
import { HealthController } from './infrastructure/http/health.controller';
import { ProcessProbe } from './infrastructure/probes/process.probe';

@Module({
  controllers: [HealthController],
  providers: [
    CheckHealth,
    ProcessProbe,
    {
      provide: HEALTH_PROBES,
      useFactory: (process: ProcessProbe) => [process],
      inject: [ProcessProbe],
    },
  ],
})
export class HealthModule {}
