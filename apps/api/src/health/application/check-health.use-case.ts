import { Inject, Injectable } from '@nestjs/common';
import { aggregate, CheckResult, HealthReport } from '../domain/health-report';
import { HEALTH_PROBES, HealthProbe } from './ports/health-probe.port';

@Injectable()
export class CheckHealth {
  constructor(
    @Inject(HEALTH_PROBES) private readonly probes: readonly HealthProbe[],
  ) {}

  async execute(): Promise<HealthReport> {
    const settled = await Promise.allSettled(
      this.probes.map((probe) => probe.check()),
    );
    const checks = settled.map((result, index): CheckResult =>
      result.status === 'fulfilled'
        ? result.value
        : { name: `probe-${index}`, status: 'down' },
    );
    return aggregate(checks);
  }
}
