import type { VisitKind } from '../../../../visits/domain/visit-kind';

// Plain interfaces on purpose: the route is hidden from Swagger, so no
// @ApiProperty metadata is needed.
export interface VisitItemDto {
  id: string;
  kind: VisitKind;
  /** ISO 8601, UTC, millisecond precision. */
  occurredAt: string;
  recruiter: { company: string | null; name: string | null };
}

export interface VisitsPageDto {
  items: VisitItemDto[];
  /** Relative URL of the next page, or `null` on the last one. */
  next: string | null;
}
