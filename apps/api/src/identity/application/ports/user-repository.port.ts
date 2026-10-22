import type { User } from '../../domain/user';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
