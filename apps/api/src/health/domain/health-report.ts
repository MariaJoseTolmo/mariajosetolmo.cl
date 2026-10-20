export type CheckStatus = 'ok' | 'down';
export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly checks: readonly CheckResult[];
}

export function aggregate(checks: readonly CheckResult[]): HealthReport {
  const down = checks.filter((check) => check.status === 'down').length;
  if (down === 0) return { status: 'ok', checks };
  return { status: down === checks.length ? 'down' : 'degraded', checks };
}
