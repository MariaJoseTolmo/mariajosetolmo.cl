import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '../../domain/role';
import type { Me } from '../../application/get-me.use-case';

export class AvailabilityDto {
  @ApiProperty({ example: '[dato de ejemplo]' })
  readonly modality!: string;

  @ApiProperty({ example: '[dato de ejemplo]' })
  readonly start!: string;

  @ApiProperty({ example: '[dato de ejemplo]' })
  readonly salary!: string;
}

export class MeResponseDto implements Me {
  @ApiProperty({ example: 'recruiter@example.test' })
  readonly email!: string;

  @ApiProperty({ enum: ROLES })
  readonly role!: Role;

  @ApiProperty({ type: String, nullable: true })
  readonly company!: string | null;

  @ApiProperty({ type: String, nullable: true })
  readonly name!: string | null;

  @ApiProperty({ type: () => AvailabilityDto })
  readonly availability!: AvailabilityDto;
}
