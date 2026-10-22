import { sha256Hex } from '../../shared/domain/hash';
import {
  type ByteSource,
  generateOpaqueToken,
  isOpaqueToken,
} from './opaque-token';
import { SessionPolicy } from './session-policy';

/** A refresh token: the clear value rides the cookie, only the hash is stored. */
export class RefreshToken {
  private constructor(
    readonly value: string,
    readonly hash: string,
  ) {}

  static generate(random: ByteSource): RefreshToken {
    return RefreshToken.of(generateOpaqueToken(random));
  }

  /**
   * A cookie is attacker-controlled input and a bad one is just "no session",
   * so a wrong shape is `null`, never an error (refresh answers 401, logout 204).
   */
  static parse(raw: unknown): RefreshToken | null {
    return isOpaqueToken(raw) ? RefreshToken.of(raw) : null;
  }

  private static of(value: string): RefreshToken {
    return new RefreshToken(value, sha256Hex(value));
  }
}

/** What is known about a token that could not be rotated (structural). */
export interface RefusedTokenState {
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface RefusalOutcome {
  /** True when the presentation is theft evidence: the family dies. */
  readonly revokeFamily: boolean;
  /** False only for the harmless race of two tabs refreshing together. */
  readonly clearCookies: boolean;
}

const REJECTED: RefusalOutcome = { revokeFamily: false, clearCookies: true };
const REUSE: RefusalOutcome = { revokeFamily: true, clearCookies: true };
const RACE: RefusalOutcome = { revokeFamily: false, clearCookies: false };

/**
 * Decides what to do with a refresh token that `rotate` refused. Always a
 * 401 for the caller; this says whether the family is revoked (reuse or
 * already revoked) and whether the browser's cookies are cleared. A token
 * spent a few seconds ago is a racing tab, not theft (design A9).
 */
export function judgeRefusedRefresh(
  state: RefusedTokenState | null,
  now: Date,
): RefusalOutcome {
  if (state === null) return REJECTED;
  if (state.revokedAt !== null) return REUSE;
  if (state.usedAt === null) return REJECTED; // unused and refused: expired
  return SessionPolicy.isWithinReuseGrace(state.usedAt, now) ? RACE : REUSE;
}
