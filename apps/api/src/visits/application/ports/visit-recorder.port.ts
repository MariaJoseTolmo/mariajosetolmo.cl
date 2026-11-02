import type { VisitKind } from '../../domain/visit-kind';

export interface VisitRecorder {
  /** Best effort: it never rejects, whatever the store does. */
  record(input: { userId: string; kind: VisitKind }): Promise<void>;
}

export const VISIT_RECORDER = Symbol('VISIT_RECORDER');
