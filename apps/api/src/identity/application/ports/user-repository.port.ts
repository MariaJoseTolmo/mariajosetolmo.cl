import type { Email } from '../../domain/email';
import type { Role } from '../../domain/role';
import type { User } from '../../domain/user';

export interface UserLogin {
  readonly email: Email;
  readonly role: Role;
  readonly company: string | null;
  readonly name: string | null;
}

export interface UserRepository {
  /**
   * Creates the user or updates them in ONE atomic statement. The role is
   * always overwritten; a null company or name keeps the stored value.
   */
  upsertOnLogin(login: UserLogin, now: Date): Promise<User>;
  findById(id: string): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
