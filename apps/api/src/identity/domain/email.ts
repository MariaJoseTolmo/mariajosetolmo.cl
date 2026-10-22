import { InvalidInput } from '../../shared/domain/errors';

const MAX_LENGTH = 254;
// Pragmatic, not RFC 5322: local@label(.label)+ with a 2+ letter TLD.
const PATTERN =
  /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]*[a-z]{2,}[a-z0-9-]*$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export class Email {
  private constructor(readonly value: string) {}

  static parse(raw: unknown): Email {
    if (typeof raw !== 'string') throw new InvalidInput('email is required');
    const value = raw.trim().toLowerCase();
    if (
      value.length === 0 ||
      value.length > MAX_LENGTH ||
      CONTROL_CHARS.test(value) ||
      !PATTERN.test(value)
    ) {
      throw new InvalidInput('email is invalid');
    }
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
