import { ApiProperty } from '@nestjs/swagger';
import type { Profile } from '../../../domain/profile';

export class ProfileDto implements Profile {
  @ApiProperty({ example: 'Ana Example' })
  readonly name!: string;

  @ApiProperty({ example: 'Software engineer' })
  readonly role!: string;

  @ApiProperty({ example: 'Hexagonal services with a thin web layer' })
  readonly architecture!: string;

  @ApiProperty({ type: [String], example: ['web', 'cloud'] })
  readonly domains!: string[];

  @ApiProperty({ example: true })
  readonly openToWork!: boolean;
}
