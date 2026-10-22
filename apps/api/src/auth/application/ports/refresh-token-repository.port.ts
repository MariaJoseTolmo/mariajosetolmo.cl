export interface NewRefreshToken {
  readonly userId: string;
  /** All tokens rotated from one login share a family; reuse revokes it. */
  readonly familyId: string;
  /** sha256 hex of the opaque token; the token itself is never stored. */
  readonly tokenHash: string;
  /** Absolute end of the session: rotation keeps it (design A8). */
  readonly expiresAt: Date;
}

/** What a successful `rotate` hands back: who, which family, until when. */
export interface ConsumedRefresh {
  readonly userId: string;
  readonly familyId: string;
  readonly expiresAt: Date;
}

/** Everything known about a token that `rotate` refused. */
export interface RefreshTokenState extends ConsumedRefresh {
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(row: NewRefreshToken): Promise<void>;
  /**
   * Replaces a token by its successor in ONE atomic step: marks `oldHash`
   * used and stores `newHash` in the same family with the same absolute end.
   * Refused (null) when the old token is unknown, used, revoked, expired, or
   * when any token of its family is revoked. Of N simultaneous callers with
   * the same `oldHash`, exactly one succeeds. A failure leaves the old token
   * untouched, so the caller can retry.
   */
  rotate(
    oldHash: string,
    newHash: string,
    now: Date,
  ): Promise<ConsumedRefresh | null>;
  findByHash(tokenHash: string): Promise<RefreshTokenState | null>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  /** Revokes the family of a known token; unknown hashes are ignored. */
  revokeFamilyOf(tokenHash: string, now: Date): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
