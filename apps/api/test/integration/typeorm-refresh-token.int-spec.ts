import { randomUUID } from 'node:crypto';
import { TypeOrmRefreshTokenRepository } from '../../src/auth/infrastructure/persistence/typeorm-refresh-token.repository';
import { InfrastructureUnavailable } from '../../src/shared/domain/errors';
import { sha256Hex } from '../../src/shared/domain/hash';
import { createDataSource } from '../../src/shared/infrastructure/persistence/data-source.factory';
import { databaseUrl } from './support/env';
import {
  openIsolatedDatabase,
  type IsolatedDatabase,
} from './support/postgres';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const EXPIRES = new Date('2026-03-08T10:00:00.000Z');

describe('TypeOrmRefreshTokenRepository (real Postgres)', () => {
  let db: IsolatedDatabase;
  let repo: TypeOrmRefreshTokenRepository;
  let userId: string;

  beforeAll(async () => {
    db = await openIsolatedDatabase();
    await db.dataSource.runMigrations();
    repo = new TypeOrmRefreshTokenRepository(db.dataSource);
    const [user] = await db.query(
      `INSERT INTO users (email) VALUES ('owner@example.test') RETURNING id`,
    );
    userId = String(user?.['id']);
  });
  afterAll(() => db.close());

  let counter = 0;
  /** A fresh token (its hash is what the repository sees). */
  const fresh = (
    overrides: Partial<{
      familyId: string;
      expiresAt: Date;
    }> = {},
  ): { hash: string; familyId: string } => {
    counter += 1;
    const hash = sha256Hex(`token-${counter}-${randomUUID()}`);
    const familyId = overrides.familyId ?? randomUUID();
    return { hash, familyId };
  };
  /** A fresh successor hash for each rotation attempt. */
  const next = (): string => {
    counter += 1;
    return sha256Hex(`successor-${counter}-${randomUUID()}`);
  };
  const insert = async (
    token: { hash: string; familyId: string },
    expiresAt: Date = EXPIRES,
  ): Promise<void> =>
    repo.create({
      userId,
      familyId: token.familyId,
      tokenHash: token.hash,
      expiresAt,
    });
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const countRows = async (): Promise<number> =>
    Number(
      (await db.query('SELECT count(*)::int AS n FROM refresh_tokens'))[0]?.[
        'n'
      ],
    );
  const rowOf = async (
    hash: string,
  ): Promise<Record<string, unknown> | undefined> => {
    const rows = await db.query(
      `SELECT user_id, family_id, expires_at, used_at, revoked_at, created_at,
              octet_length(token_hash) AS hash_bytes,
              encode(token_hash, 'hex') AS hash_hex
       FROM refresh_tokens WHERE token_hash = decode($1, 'hex')`,
      [hash],
    );
    return rows[0];
  };

  describe('create', () => {
    it('stores the hash as 32 bytes, unused and unrevoked, with the absolute expiry', async () => {
      const token = fresh();
      await insert(token);
      const row = await rowOf(token.hash);
      expect(row).toMatchObject({
        user_id: userId,
        family_id: token.familyId,
        expires_at: EXPIRES,
        used_at: null,
        revoked_at: null,
        hash_bytes: 32,
        hash_hex: token.hash,
      });
      expect(row?.['created_at']).toBeInstanceOf(Date);
    });

    it('rejects a second token with the same hash', async () => {
      const token = fresh();
      await insert(token);
      await expect(insert(token)).rejects.toBeInstanceOf(
        InfrastructureUnavailable,
      );
    });
  });

  describe('rotate', () => {
    it('marks the token used and returns who and which family', async () => {
      const token = fresh();
      await insert(token);
      await expect(repo.rotate(token.hash, next(), NOW)).resolves.toEqual({
        userId,
        familyId: token.familyId,
        expiresAt: EXPIRES,
      });
      expect((await rowOf(token.hash))?.['used_at']).toEqual(NOW);
    });

    it('answers null the second time, without moving used_at', async () => {
      const token = fresh();
      await insert(token);
      await repo.rotate(token.hash, next(), NOW);
      const later = new Date(NOW.getTime() + 60_000);
      await expect(repo.rotate(token.hash, next(), later)).resolves.toBeNull();
      expect((await rowOf(token.hash))?.['used_at']).toEqual(NOW);
    });

    it('answers null for an unknown hash', async () => {
      await expect(
        repo.rotate(sha256Hex('never-issued'), next(), NOW),
      ).resolves.toBeNull();
    });

    it('answers null for a revoked token, and does not mark it used', async () => {
      const token = fresh();
      await insert(token);
      await repo.revokeFamily(token.familyId, NOW);
      await expect(repo.rotate(token.hash, next(), NOW)).resolves.toBeNull();
      expect((await rowOf(token.hash))?.['used_at']).toBeNull();
    });

    it('honours the absolute expiry: valid 1 ms before, refused at the instant', async () => {
      const early = fresh();
      const exact = fresh();
      await insert(early);
      await insert(exact);
      await expect(
        repo.rotate(early.hash, next(), new Date(EXPIRES.getTime() - 1)),
      ).resolves.toMatchObject({ familyId: early.familyId });
      await expect(
        repo.rotate(exact.hash, next(), EXPIRES),
      ).resolves.toBeNull();
      expect((await rowOf(exact.hash))?.['used_at']).toBeNull();
    });

    it('lets exactly one of 20 simultaneous callers win', async () => {
      const token = fresh();
      await insert(token);
      const results = await Promise.all(
        Array.from({ length: 20 }, () => repo.rotate(token.hash, next(), NOW)),
      );
      expect(results.filter((r) => r !== null)).toHaveLength(1);
      expect(results.filter((r) => r === null)).toHaveLength(19);
    });

    it('stores the successor in the same family, unused, with the same absolute end', async () => {
      const token = fresh();
      await insert(token);
      const successor = next();
      await repo.rotate(token.hash, successor, NOW);
      expect(await rowOf(successor)).toMatchObject({
        user_id: userId,
        family_id: token.familyId,
        expires_at: EXPIRES,
        used_at: null,
        revoked_at: null,
        hash_bytes: 32,
      });
    });

    it('writes no successor when it refuses (unknown, used, expired)', async () => {
      const used = fresh();
      const expired = fresh();
      await insert(used);
      await insert(expired);
      await repo.rotate(used.hash, next(), NOW);
      const before = await countRows();
      await repo.rotate(used.hash, next(), NOW);
      await repo.rotate(expired.hash, next(), EXPIRES);
      await repo.rotate(sha256Hex('never-issued'), next(), NOW);
      expect(await countRows()).toBe(before);
    });

    it('refuses once the family is revoked, and writes nothing', async () => {
      const token = fresh();
      await insert(token);
      await repo.revokeFamily(token.familyId, NOW);
      const successor = next();
      await expect(repo.rotate(token.hash, successor, NOW)).resolves.toBeNull();
      expect(await rowOf(successor)).toBeUndefined();
    });

    it('refuses a live token whose family has a revoked row (revoke landed between read and rotate)', async () => {
      const familyId = randomUUID();
      const old = fresh({ familyId });
      const straggler = fresh({ familyId });
      await insert(old);
      await repo.revokeFamily(familyId, NOW);
      // Written after the revocation, the way a racing rotation used to.
      await insert(straggler);
      expect((await rowOf(straggler.hash))?.['revoked_at']).toBeNull();
      const successor = next();
      await expect(
        repo.rotate(straggler.hash, successor, NOW),
      ).resolves.toBeNull();
      expect(await rowOf(successor)).toBeUndefined();
      expect((await rowOf(straggler.hash))?.['used_at']).toBeNull();
    });

    it('never leaves a live token in a revoked family when revoke races rotate (40 trials)', async () => {
      for (let trial = 0; trial < 40; trial += 1) {
        const token = fresh();
        await insert(token);
        const successor = next();
        const jitter = trial % 3;
        await Promise.all([
          repo.rotate(token.hash, successor, NOW),
          jitter === 0
            ? repo.revokeFamily(token.familyId, NOW)
            : jitter === 1
              ? repo.revokeFamilyOf(token.hash, NOW)
              : delay(1).then(() => repo.revokeFamily(token.familyId, NOW)),
        ]);
        const live = await db.query(
          `SELECT count(*)::int AS n FROM refresh_tokens
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [token.familyId],
        );
        expect(live[0]?.['n']).toBe(0);
      }
    });
  });

  describe('findByHash', () => {
    it('reports an unused token', async () => {
      const token = fresh();
      await insert(token);
      await expect(repo.findByHash(token.hash)).resolves.toEqual({
        userId,
        familyId: token.familyId,
        expiresAt: EXPIRES,
        usedAt: null,
        revokedAt: null,
      });
    });

    it('reports when it was used and when it was revoked', async () => {
      const used = fresh();
      await insert(used);
      await repo.rotate(used.hash, next(), NOW);
      expect(await repo.findByHash(used.hash)).toMatchObject({
        usedAt: NOW,
        revokedAt: null,
      });
      const later = new Date(NOW.getTime() + 5000);
      await repo.revokeFamily(used.familyId, later);
      expect(await repo.findByHash(used.hash)).toMatchObject({
        usedAt: NOW,
        revokedAt: later,
      });
    });

    it('answers null for an unknown hash', async () => {
      await expect(
        repo.findByHash(sha256Hex('never-issued')),
      ).resolves.toBeNull();
    });
  });

  describe('revoking', () => {
    it('revokeFamily revokes every token of that family and no other', async () => {
      const familyId = randomUUID();
      const a = fresh({ familyId });
      const b = fresh({ familyId });
      const other = fresh();
      await insert(a);
      await insert(b);
      await insert(other);
      await repo.revokeFamily(familyId, NOW);
      expect((await rowOf(a.hash))?.['revoked_at']).toEqual(NOW);
      expect((await rowOf(b.hash))?.['revoked_at']).toEqual(NOW);
      expect((await rowOf(other.hash))?.['revoked_at']).toBeNull();
    });

    it('keeps the first revocation time when revoked twice', async () => {
      const token = fresh();
      await insert(token);
      await repo.revokeFamily(token.familyId, NOW);
      await repo.revokeFamily(token.familyId, new Date(NOW.getTime() + 60_000));
      expect((await rowOf(token.hash))?.['revoked_at']).toEqual(NOW);
    });

    it('revokeFamilyOf finds the family through any token, even a used one', async () => {
      const familyId = randomUUID();
      const parent = fresh({ familyId });
      const child = fresh({ familyId });
      const other = fresh();
      await insert(parent);
      await insert(child);
      await insert(other);
      await repo.rotate(parent.hash, next(), NOW);
      await repo.revokeFamilyOf(parent.hash, NOW);
      expect((await rowOf(parent.hash))?.['revoked_at']).toEqual(NOW);
      expect((await rowOf(child.hash))?.['revoked_at']).toEqual(NOW);
      expect((await rowOf(other.hash))?.['revoked_at']).toBeNull();
    });

    it('revokeFamilyOf ignores an unknown hash without touching anything', async () => {
      const token = fresh();
      await insert(token);
      await expect(
        repo.revokeFamilyOf(sha256Hex('never-issued'), NOW),
      ).resolves.toBeUndefined();
      expect((await rowOf(token.hash))?.['revoked_at']).toBeNull();
    });
  });

  it('fails closed with InfrastructureUnavailable when the database is down', async () => {
    const broken = new TypeOrmRefreshTokenRepository(
      createDataSource('postgres://x:y@127.0.0.1:1/none'),
    );
    const hash = sha256Hex('x');
    await expect(
      broken.rotate(hash, sha256Hex('y'), NOW),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
    await expect(broken.findByHash(hash)).rejects.toBeInstanceOf(
      InfrastructureUnavailable,
    );
    await expect(broken.revokeFamilyOf(hash, NOW)).rejects.toBeInstanceOf(
      InfrastructureUnavailable,
    );
  });

  it('opens an unopened DataSource on first use', async () => {
    const lazy = createDataSource(databaseUrl(), {
      options: `-c search_path=${db.schema}`,
    });
    try {
      expect(lazy.isInitialized).toBe(false);
      await expect(
        new TypeOrmRefreshTokenRepository(lazy).findByHash(sha256Hex('none')),
      ).resolves.toBeNull();
      expect(lazy.isInitialized).toBe(true);
    } finally {
      if (lazy.isInitialized) await lazy.destroy();
    }
  });
});
