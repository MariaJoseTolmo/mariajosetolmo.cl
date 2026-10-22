import type { Role } from './role';

/** The authenticated caller, derived from a verified access token only. */
export interface Principal {
  readonly userId: string;
  readonly role: Role;
}
