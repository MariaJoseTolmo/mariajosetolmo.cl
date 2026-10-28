import { ApiProperty } from '@nestjs/swagger';

export class ExperienceItemDto {
  @ApiProperty({ example: 'acme-platform' })
  readonly id!: string;

  @ApiProperty({ example: 'Acme' })
  readonly company!: string;

  @ApiProperty({ example: 'Backend engineer' })
  readonly role!: string;

  @ApiProperty({ example: 'Retail' })
  readonly sector!: string;

  @ApiProperty({ example: '2021 - 2023' })
  readonly period!: string;

  @ApiProperty({ type: [String] })
  readonly highlights!: string[];

  @ApiProperty({ type: [String] })
  readonly technologies!: string[];
}

export class ExperiencePageDto {
  @ApiProperty({ type: [ExperienceItemDto] })
  readonly items!: ExperienceItemDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL of the next page, or null on the last page.',
    example: '/api/v1/experience?cursor=2&limit=2',
  })
  readonly next!: string | null;
}
