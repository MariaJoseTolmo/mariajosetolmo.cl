import type { DataSource } from 'typeorm';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import type {
  UserLogin,
  UserRepository,
} from '../../application/ports/user-repository.port';
import { Email } from '../../domain/email';
import { isRole } from '../../domain/role';
import type { User } from '../../domain/user';

interface UserRow {
  id: string;
  email: string;
  role: string;
  company: string | null;
  name: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = 'id, email, role, company, name';

// One statement: no transaction, no session state (safe behind a pooler).
const UPSERT_ON_LOGIN = `
  INSERT INTO users (email, role, company, name, last_login_at)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    company = COALESCE(EXCLUDED.company, users.company),
    name = COALESCE(EXCLUDED.name, users.name),
    last_login_at = EXCLUDED.last_login_at
  RETURNING ${COLUMNS}`;

function toUser(row: UserRow): User {
  if (!isRole(row.role)) throw new Error('Unexpected role in users');
  return {
    id: row.id,
    email: Email.parse(row.email),
    role: row.role,
    company: row.company,
    name: row.name,
  };
}

export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async upsertOnLogin(login: UserLogin, now: Date): Promise<User> {
    const rows = await withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      return this.dataSource.query<UserRow[]>(UPSERT_ON_LOGIN, [
        login.email.value,
        login.role,
        login.company,
        login.name,
        now,
      ]);
    });
    const row = rows[0];
    if (!row) throw new Error('Upsert returned no row');
    return toUser(row);
  }

  async findById(id: string): Promise<User | null> {
    // The id comes from our own signed token; a malformed one is just unknown.
    if (!UUID.test(id)) return null;
    const rows = await withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      return this.dataSource.query<UserRow[]>(
        `SELECT ${COLUMNS} FROM users WHERE id = $1`,
        [id],
      );
    });
    const row = rows[0];
    return row ? toUser(row) : null;
  }
}
