import type {
  ConsumedRefresh,
  NewRefreshToken,
  RefreshTokenRepository,
  RefreshTokenState,
} from '../../application/ports/refresh-token-repository.port';

interface Entry {
  readonly row: NewRefreshToken;
  usedAt: Date | null;
  revokedAt: Date | null;
}

/** Test double with the same contract as the Postgres repository. */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly entries = new Map<string, Entry>();

  create(row: NewRefreshToken): Promise<void> {
    this.entries.set(row.tokenHash, { row, usedAt: null, revokedAt: null });
    return Promise.resolve();
  }

  rotate(
    tokenHash: string,
    newHash: string,
    now: Date,
  ): Promise<ConsumedRefresh | null> {
    const entry = this.entries.get(tokenHash);
    // Synchronous check-and-set: the atomic UPDATE of the real repository.
    if (
      !entry ||
      entry.usedAt !== null ||
      entry.revokedAt !== null ||
      this.familyHasRevokedRow(entry.row.familyId) ||
      entry.row.expiresAt.getTime() <= now.getTime()
    ) {
      return Promise.resolve(null);
    }
    entry.usedAt = now;
    this.entries.set(newHash, {
      row: { ...entry.row, tokenHash: newHash },
      usedAt: null,
      revokedAt: null,
    });
    return Promise.resolve({
      userId: entry.row.userId,
      familyId: entry.row.familyId,
      expiresAt: entry.row.expiresAt,
    });
  }

  private familyHasRevokedRow(familyId: string): boolean {
    return [...this.entries.values()].some(
      (e) => e.row.familyId === familyId && e.revokedAt !== null,
    );
  }

  findByHash(tokenHash: string): Promise<RefreshTokenState | null> {
    const entry = this.entries.get(tokenHash);
    return Promise.resolve(
      entry
        ? {
            userId: entry.row.userId,
            familyId: entry.row.familyId,
            expiresAt: entry.row.expiresAt,
            usedAt: entry.usedAt,
            revokedAt: entry.revokedAt,
          }
        : null,
    );
  }

  revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const entry of this.entries.values()) {
      if (entry.row.familyId === familyId && entry.revokedAt === null) {
        entry.revokedAt = now;
      }
    }
    return Promise.resolve();
  }

  async revokeFamilyOf(tokenHash: string, now: Date): Promise<void> {
    const entry = this.entries.get(tokenHash);
    if (entry) await this.revokeFamily(entry.row.familyId, now);
  }

  /** The rows as they were created (no usage state). */
  all(): readonly NewRefreshToken[] {
    return [...this.entries.values()].map((entry) => entry.row);
  }
}
