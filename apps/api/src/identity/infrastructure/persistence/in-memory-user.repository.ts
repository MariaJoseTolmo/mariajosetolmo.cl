import type {
  UserLogin,
  UserRepository,
} from '../../application/ports/user-repository.port';
import type { User } from '../../domain/user';

/** Test double with the same contract as the Postgres repository (e2e and use-case specs). */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private nextId = 1;

  seed(user: User): void {
    this.users.set(user.id, user);
  }

  all(): User[] {
    return [...this.users.values()];
  }

  remove(id: string): void {
    this.users.delete(id);
  }

  /** Same contract as the SQL upsert: the role wins, null keeps the old text. */
  upsertOnLogin(login: UserLogin, now: Date): Promise<User> {
    void now; // the double keeps no login timestamp
    const existing = this.all().find((user) => user.email.equals(login.email));
    const user: User = {
      id: existing?.id ?? `user-${this.nextId++}`,
      email: login.email,
      role: login.role,
      company: login.company ?? existing?.company ?? null,
      name: login.name ?? existing?.name ?? null,
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }
}
