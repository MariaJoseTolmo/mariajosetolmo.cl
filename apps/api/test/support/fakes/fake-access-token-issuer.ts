import type {
  AccessTokenClaims,
  AccessTokenIssuer,
} from '../../../src/auth/application/ports/access-token.port';

/** Returns a readable stand-in token and remembers what it was asked to sign. */
export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  readonly issued: { claims: AccessTokenClaims; now: Date }[] = [];

  issue(claims: AccessTokenClaims, now: Date): Promise<string> {
    this.issued.push({ claims, now });
    return Promise.resolve(`jwt.${claims.sub}.${claims.role}`);
  }
}
