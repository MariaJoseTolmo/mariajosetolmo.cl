import { InvalidInput } from '../../shared/domain/errors';
import type { VisitEvent } from './visit-event';

const MAX_LENGTH = 96;
const ALPHABET = /^[A-Za-z0-9_-]+$/;
const PAYLOAD =
  /^(\d{1,16})\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Opaque position in the visit listing: base64url of "<epochMs>.<uuid>" (the
 * keyset (occurred_at, id)). Parsing is strict and canonical, so a cursor
 * that reaches SQL always has a valid instant and uuid.
 */
export class VisitCursor {
  private constructor(
    readonly occurredAt: Date,
    readonly id: string,
  ) {}

  /** `null` for anything that is not exactly what `encode` produces. */
  static parse(raw: unknown): VisitCursor | null {
    if (typeof raw !== 'string') return null;
    if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
    if (!ALPHABET.test(raw)) return null;
    const payload = Buffer.from(raw, 'base64url').toString('utf8');
    // Re-encoding must give the same text: rejects non-canonical base64.
    if (Buffer.from(payload).toString('base64url') !== raw) return null;
    const match = PAYLOAD.exec(payload);
    if (match === null) return null;
    const [, digits = '', id = ''] = match;
    const epochMs = Number(digits);
    if (!Number.isSafeInteger(epochMs) || String(epochMs) !== digits) {
      return null;
    }
    const occurredAt = new Date(epochMs);
    if (Number.isNaN(occurredAt.getTime())) return null;
    return new VisitCursor(occurredAt, id);
  }

  /** Like `parse`, but a bad value is an INVALID_INPUT that never echoes it. */
  static parseOrThrow(raw: unknown): VisitCursor {
    const cursor = VisitCursor.parse(raw);
    if (cursor === null) throw new InvalidInput('cursor is invalid');
    return cursor;
  }

  static from(event: Pick<VisitEvent, 'id' | 'occurredAt'>): VisitCursor {
    return new VisitCursor(event.occurredAt, event.id);
  }

  encode(): string {
    return Buffer.from(`${this.occurredAt.getTime()}.${this.id}`).toString(
      'base64url',
    );
  }
}
