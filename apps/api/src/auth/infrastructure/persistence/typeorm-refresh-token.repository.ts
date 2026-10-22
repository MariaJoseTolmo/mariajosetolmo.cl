import type { DataSource } from 'typeorm';
import { withDatabase } from '../../../shared/infrastructure/persistence/database-errors';
import { ensureInitialized } from '../../../shared/infrastructure/persistence/lazy-initialize';
import type {
  ConsumedRefresh,
  NewRefreshToken,
  RefreshTokenRepository,
  RefreshTokenState,
} from '../../application/ports/refresh-token-repository.port';

interface ConsumedRow {
  user_id: string;
  family_id: string;
  expires_at: Date;
}

interface StateRow extends ConsumedRow {
  used_at: Date | null;
  revoked_at: Date | null;
}

// Every statement is a single round trip with no session state: safe behind
// a transaction pooler. Hashes travel as hex text and become bytea in SQL.
const INSERT = `
  INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
  VALUES ($1, $2, decode($3, 'hex'), $4)`;

// Rotation is ONE statement, so a failure leaves the old token untouched and
// a revocation can never be undone by a half-finished rotation. Under READ
// COMMITTED a second UPDATE on the same row waits for the lock and re-reads
// it: exactly one rotation wins. The NOT EXISTS refuses a family that already
// has a revoked row. Revocation closes the remaining window (see revoke).
const ROTATE = `
  WITH spent AS (
    UPDATE refresh_tokens SET used_at = $3
    WHERE token_hash = decode($1, 'hex')
      AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $3
      AND NOT EXISTS (
        SELECT 1 FROM refresh_tokens r
        WHERE r.family_id = refresh_tokens.family_id AND r.revoked_at IS NOT NULL
      )
    RETURNING user_id, family_id, expires_at
  )
  INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
  SELECT user_id, family_id, decode($2, 'hex'), expires_at FROM spent
  RETURNING user_id, family_id, expires_at`;

const FIND = `
  SELECT user_id, family_id, expires_at, used_at, revoked_at
  FROM refresh_tokens WHERE token_hash = decode($1, 'hex')`;

const REVOKE_FAMILY = `
  UPDATE refresh_tokens SET revoked_at = $2
  WHERE family_id = $1 AND revoked_at IS NULL
  RETURNING 1 AS revoked`;

const REVOKE_FAMILY_OF = `
  UPDATE refresh_tokens SET revoked_at = $2
  WHERE revoked_at IS NULL AND family_id = (
    SELECT family_id FROM refresh_tokens WHERE token_hash = decode($1, 'hex')
  )
  RETURNING 1 AS revoked`;

// A revocation that waits for the row lock of a rotation in flight does not
// see the successor that rotation inserts (READ COMMITTED snapshot per
// statement). So it repeats, each pass with a fresh snapshot, until a pass
// revokes nothing: then no live token is left and none can be mid-rotation.
// Normally two passes; the cap only guards against an endless loop.
const MAX_REVOKE_PASSES = 5;

export class TypeOrmRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(row: NewRefreshToken): Promise<void> {
    await this.run(INSERT, [
      row.userId,
      row.familyId,
      row.tokenHash,
      row.expiresAt,
    ]);
  }

  async rotate(
    tokenHash: string,
    newHash: string,
    now: Date,
  ): Promise<ConsumedRefresh | null> {
    const row = (
      await this.run<ConsumedRow>(ROTATE, [tokenHash, newHash, now])
    )[0];
    return row ? toConsumed(row) : null;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenState | null> {
    const row = (await this.run<StateRow>(FIND, [tokenHash]))[0];
    return row
      ? { ...toConsumed(row), usedAt: row.used_at, revokedAt: row.revoked_at }
      : null;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.revokeUntilQuiet(REVOKE_FAMILY, [familyId, now]);
  }

  async revokeFamilyOf(tokenHash: string, now: Date): Promise<void> {
    await this.revokeUntilQuiet(REVOKE_FAMILY_OF, [tokenHash, now]);
  }

  private async revokeUntilQuiet(
    sql: string,
    params: unknown[],
  ): Promise<void> {
    for (let pass = 0; pass < MAX_REVOKE_PASSES; pass += 1) {
      if ((await this.run(sql, params)).length === 0) return;
    }
  }

  private run<T = unknown>(sql: string, params: unknown[]): Promise<T[]> {
    return withDatabase(async () => {
      await ensureInitialized(this.dataSource);
      // pg returns [rows, count] for UPDATE ... RETURNING through TypeORM.
      const result = await this.dataSource.query<T[] | [T[], number]>(
        sql,
        params,
      );
      return normalizeRows<T>(result);
    });
  }
}

function toConsumed(row: ConsumedRow): ConsumedRefresh {
  return {
    userId: row.user_id,
    familyId: row.family_id,
    expiresAt: row.expires_at,
  };
}

/** TypeORM returns `[rows, affected]` for UPDATE and `rows` for SELECT. */
function normalizeRows<T>(result: T[] | [T[], number]): T[] {
  const [first, second] = result;
  return Array.isArray(first) && typeof second === 'number'
    ? first
    : (result as T[]);
}
