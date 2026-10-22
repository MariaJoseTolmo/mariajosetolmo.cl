export interface Secrets {
  readonly jwtPrivateKeyPem: string;
  readonly jwtKeyId: string;
  /** Manual rotation (ADR-008): the retired key stays in the JWKS. */
  readonly jwtPreviousPublicKeyPem: string | null;
  readonly jwtPreviousKeyId: string | null;
  readonly adminEmail: string;
  readonly databaseUrl: string;
  readonly redisUrl: string;
}

export interface SecretsProvider {
  load(): Promise<Secrets>;
}

export const SECRETS_PROVIDER = Symbol('SECRETS_PROVIDER');

/** The secrets resolved once at boot (the value, not the provider). */
export const APP_SECRETS = Symbol('APP_SECRETS');
