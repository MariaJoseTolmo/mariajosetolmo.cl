/** What a magic link remembers until it is verified. Never holds the token. */
export interface MagicLinkPayload {
  readonly email: string;
  readonly company?: string;
  readonly name?: string;
}

export interface MagicLinkStore {
  /** Keyed by sha256(token); the clear token never reaches the store. */
  save(
    tokenHash: string,
    payload: MagicLinkPayload,
    ttlSeconds: number,
  ): Promise<void>;
  /** Atomic read-and-delete: of N concurrent calls only one gets the payload. */
  consume(tokenHash: string): Promise<MagicLinkPayload | null>;
}

export const MAGIC_LINK_STORE = Symbol('MAGIC_LINK_STORE');
