import type { VisitKind } from './visit-kind';

/** One recruiter action. No IP, user agent or email: only who, what and when. */
export interface VisitEvent {
  id: string;
  userId: string;
  kind: VisitKind;
  /** Always from the Clock, so it has millisecond precision. */
  occurredAt: Date;
}
