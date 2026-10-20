import { CheckResult } from '../../domain/health-report';

export interface HealthProbe {
  check(): Promise<CheckResult>;
}

export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
