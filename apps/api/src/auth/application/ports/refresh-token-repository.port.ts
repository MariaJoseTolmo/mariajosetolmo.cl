export interface NewRefreshToken {
  readonly userId: string;
  /** All tokens rotated from one login share a family; reuse revokes it. */
  readonly familyId: string;
  /** sha256 hex of the opaque token; the token itself is never stored. */
  readonly tokenHash: string;
  /** Absolute end of the session: rotation keeps it (design A8). */
  readonly expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(row: NewRefreshToken): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
