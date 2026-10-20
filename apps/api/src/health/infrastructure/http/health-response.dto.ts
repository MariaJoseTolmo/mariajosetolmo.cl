import { ApiProperty } from '@nestjs/swagger';
import type {
  CheckResult,
  CheckStatus,
  HealthReport,
  HealthStatus,
} from '../../domain/health-report';

const CHECK_STATUSES: CheckStatus[] = ['ok', 'down'];
const HEALTH_STATUSES: HealthStatus[] = ['ok', 'degraded', 'down'];

export class HealthCheckDto implements CheckResult {
  @ApiProperty({ example: 'process' })
  readonly name!: string;

  @ApiProperty({ enum: CHECK_STATUSES })
  readonly status!: CheckStatus;
}

export class HealthResponseDto implements HealthReport {
  @ApiProperty({ enum: HEALTH_STATUSES })
  readonly status!: HealthStatus;

  @ApiProperty({ type: () => [HealthCheckDto] })
  readonly checks!: HealthCheckDto[];
}
