import { ApiProperty } from '@nestjs/swagger';
import { SKILL_LEVELS, type SkillLevel } from '../../../domain/skill-level';

export class SkillGroupDto {
  @ApiProperty({ enum: SKILL_LEVELS })
  readonly level!: SkillLevel;

  @ApiProperty({ type: [String] })
  readonly skills!: string[];
}

export class SkillLevelsDto {
  @ApiProperty({
    type: [SkillGroupDto],
    description: 'The four levels in fixed order.',
  })
  readonly levels!: SkillGroupDto[];
}
