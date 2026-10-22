import type { UserRepository } from '../../application/ports/user-repository.port';
import type { User } from '../../domain/user';

/** Stand-in until the Postgres repository lands; also the e2e fake. */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  seed(user: User): void {
    this.users.set(user.id, user);
  }

  remove(id: string): void {
    this.users.delete(id);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }
}
