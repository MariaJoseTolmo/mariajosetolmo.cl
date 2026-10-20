import { Injectable } from '@nestjs/common';
import { CheckResult } from '../../domain/health-report';
import { HealthProbe } from '../../application/ports/health-probe.port';

@Injectable()
export class ProcessProbe implements HealthProbe {
  async check(): Promise<CheckResult> {
    return { name: 'process', status: 'ok' };
  }
}
