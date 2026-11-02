import { InvalidInput } from '../../shared/domain/errors';

/** What a recruiter did: signed in, or asked for a CV link. */
export const VISIT_KINDS = ['LOGIN', 'CV_LINK'] as const;

export type VisitKind = (typeof VISIT_KINDS)[number];

/** `undefined` means "all kinds" and gives `null`; anything else must match exactly. */
export function parseKindFilter(raw: unknown): VisitKind | null {
  if (raw === undefined) return null;
  const kind = VISIT_KINDS.find((candidate) => candidate === raw);
  if (kind === undefined) {
    throw new InvalidInput('kind is not a known visit kind');
  }
  return kind;
}
