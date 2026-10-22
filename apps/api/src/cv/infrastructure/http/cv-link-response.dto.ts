import { ApiProperty } from '@nestjs/swagger';
import type { CvLink } from '../../application/get-cv-link.use-case';

export class CvLinkResponseDto implements CvLink {
  @ApiProperty({
    description: 'Temporary download URL for the CV; a new one on every call.',
    example: 'https://cv.example.test/cv-de-ejemplo.pdf',
  })
  readonly url!: string;

  @ApiProperty({
    description: 'Instant the URL stops working (ISO 8601, UTC).',
    example: '2026-01-01T00:05:00.000Z',
  })
  readonly expiresAt!: string;
}
