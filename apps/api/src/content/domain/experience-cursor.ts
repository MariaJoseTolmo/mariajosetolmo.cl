import { InvalidInput } from '../../shared/domain/errors';

const DIGITS = /^\d+$/;

/** Keyset position after which the next experience page starts; 0 when absent. */
export class ExperienceCursor {
  private constructor(readonly value: number) {}

  static parse(raw: unknown): ExperienceCursor {
    if (raw === undefined) return new ExperienceCursor(0);
    if (typeof raw !== 'string' || !DIGITS.test(raw)) {
      throw new InvalidInput('cursor must be a non-negative integer');
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) {
      throw new InvalidInput('cursor must be a non-negative integer');
    }
    return new ExperienceCursor(value);
  }
}
