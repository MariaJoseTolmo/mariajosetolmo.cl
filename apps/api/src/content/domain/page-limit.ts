import { InvalidInput } from '../../shared/domain/errors';

export const DEFAULT_PAGE_LIMIT = 5;
const MIN = 1;
const MAX = 50;
const DIGITS = /^\d+$/;

/** Page size of a listing: an integer in 1..50, 5 when absent. */
export class PageLimit {
  private constructor(readonly value: number) {}

  static parse(raw: unknown): PageLimit {
    if (raw === undefined) return new PageLimit(DEFAULT_PAGE_LIMIT);
    if (typeof raw !== 'string' || !DIGITS.test(raw)) {
      throw new InvalidInput('limit must be an integer between 1 and 50');
    }
    const value = Number(raw);
    if (value < MIN || value > MAX) {
      throw new InvalidInput('limit must be an integer between 1 and 50');
    }
    return new PageLimit(value);
  }
}
