import type { Email } from './email';
import type { Role } from './role';

/**
 * Role comes from one configured address, never from anything the caller sends.
 * Recomputed on every login (D2): change the config and the previous
 * administrator is a recruiter again at their next verify.
 */
export const AdminPolicy = {
  roleFor(email: Email, adminEmail: string): Role {
    const admin = adminEmail.trim().toLowerCase();
    return admin !== '' && email.value === admin ? 'ADMIN' : 'RECRUITER';
  },
} as const;
