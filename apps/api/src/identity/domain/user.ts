import { InvalidInput } from '../../shared/domain/errors';
import type { Email } from './email';
import type { Role } from './role';

export interface User {
  readonly id: string;
  readonly email: Email;
  readonly role: Role;
  readonly company: string | null;
  readonly name: string | null;
}

const MAX_TEXT_LENGTH = 120;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Optional free text on a user (company, name): trimmed, bounded, no control chars. */
export function optionalProfileText(
  raw: unknown,
  field: 'company' | 'name',
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new InvalidInput(`${field} must be text`);
  const value = raw.trim();
  if (value === '') return null;
  if (value.length > MAX_TEXT_LENGTH || CONTROL_CHARS.test(value)) {
    throw new InvalidInput(`${field} is invalid`);
  }
  return value;
}
