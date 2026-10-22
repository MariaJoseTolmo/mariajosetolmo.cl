import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Principal } from '../../../identity/domain/principal';
import { isRole } from '../../../identity/domain/role';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  AccessTokenVerifier,
  JwksProvider,
  PublicJwk,
} from '../../application/ports/access-token.port';
import { SessionPolicy } from '../../domain/session-policy';

const ALGORITHM = 'RS256';
const CLOCK_TOLERANCE_SECONDS = 5;
const MIN_RSA_MODULUS_BITS = 2048;

function assertStrongRsa(key: KeyObject, label: string): void {
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error(`${label} must be an RSA key`);
  }
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < MIN_RSA_MODULUS_BITS) {
    throw new Error(`${label} must be at least ${MIN_RSA_MODULUS_BITS} bits`);
  }
}

export interface JoseAccessTokenOptions {
  readonly privateKeyPem: string;
  readonly keyId: string;
  /** Retired key kept for verification and the JWKS during rotation. */
  readonly previousPublicKeyPem: string | null;
  readonly previousKeyId: string | null;
  readonly issuer: string;
  readonly audience: string;
}

export class JoseAccessTokenService
  implements AccessTokenIssuer, AccessTokenVerifier, JwksProvider
{
  private readonly signingKey: KeyObject;
  private readonly verificationKeys = new Map<string, KeyObject>();

  constructor(private readonly options: JoseAccessTokenOptions) {
    // Parsing here makes a malformed key fail at boot, not at first login.
    this.signingKey = createPrivateKey(options.privateKeyPem);
    assertStrongRsa(this.signingKey, 'Signing key');
    this.verificationKeys.set(options.keyId, createPublicKey(this.signingKey));
    if (options.previousPublicKeyPem && options.previousKeyId) {
      const previous = createPublicKey(options.previousPublicKeyPem);
      assertStrongRsa(previous, 'Previous public key');
      this.verificationKeys.set(options.previousKeyId, previous);
    }
  }

  async issue(claims: AccessTokenClaims, now: Date): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: ALGORITHM, kid: this.options.keyId })
      .setSubject(claims.sub)
      .setIssuer(this.options.issuer)
      .setAudience(this.options.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + SessionPolicy.ACCESS_TTL_SECONDS)
      .sign(this.signingKey);
  }

  async verify(jwt: string, now: Date): Promise<Principal | null> {
    try {
      const { payload } = await jwtVerify(
        jwt,
        (header) => {
          const key = header.kid
            ? this.verificationKeys.get(header.kid)
            : undefined;
          if (!key) throw new Error('unknown kid');
          return key;
        },
        {
          algorithms: [ALGORITHM],
          issuer: this.options.issuer,
          audience: this.options.audience,
          currentDate: now,
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
          requiredClaims: ['sub', 'iat', 'exp'],
        },
      );
      const role = payload['role'];
      if (!payload.sub || !isRole(role)) return null;
      return { userId: payload.sub, role };
    } catch {
      return null;
    }
  }

  jwks(): { keys: PublicJwk[] } {
    const keys = [...this.verificationKeys].map(([kid, key]) => {
      const { n, e } = key.export({ format: 'jwk' });
      return {
        kty: 'RSA',
        kid,
        alg: ALGORITHM,
        use: 'sig',
        n: n ?? '',
        e: e ?? '',
      };
    });
    return { keys };
  }
}
