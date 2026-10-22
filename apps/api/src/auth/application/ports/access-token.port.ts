import type { Principal } from '../../../identity/domain/principal';
import type { Role } from '../../../identity/domain/role';

export interface AccessTokenClaims {
  readonly sub: string;
  readonly role: Role;
}

export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims, now: Date): Promise<string>;
}

/** Resolves to null for any invalid token; never throws on bad input. */
export interface AccessTokenVerifier {
  verify(jwt: string, now: Date): Promise<Principal | null>;
}

export interface PublicJwk {
  readonly kty: string;
  readonly kid: string;
  readonly alg: string;
  readonly use: string;
  readonly n: string;
  readonly e: string;
}

export interface JwksProvider {
  jwks(): { keys: PublicJwk[] };
}

export const ACCESS_TOKEN_ISSUER = Symbol('ACCESS_TOKEN_ISSUER');
export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
export const JWKS_PROVIDER = Symbol('JWKS_PROVIDER');
