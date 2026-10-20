import { Injectable } from '@nestjs/common';
import { CheckResult } from '../../domain/health-report';
import { HealthProbe } from '../../application/ports/health-probe.port';

@Injectable()
export class ProcessProbe implements HealthProbe {
  check(): Promise<CheckResult> {
    return Promise.resolve({ name: 'process', status: 'ok' });
  }
}
