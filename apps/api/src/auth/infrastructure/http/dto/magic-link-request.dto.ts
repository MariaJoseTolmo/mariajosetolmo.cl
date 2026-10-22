import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Documents the body only: the rules live in the domain (Email, profile text). */
export class MagicLinkRequestDto {
  @ApiProperty({ example: 'recruiter@example.test' })
  email!: string;

  @ApiPropertyOptional({ example: 'Example Company', maxLength: 120 })
  company?: string;

  @ApiPropertyOptional({ example: 'Example Name', maxLength: 120 })
  name?: string;
}

export class AcceptedResponseDto {
  @ApiProperty({ example: 'accepted' })
  status!: 'accepted';
}

export class VerifyRequestDto {
  @ApiProperty({
    description: 'The 43-character token from the link fragment.',
    example: 'a-43-character-base64url-token-from-the-email',
  })
  token!: string;
}
