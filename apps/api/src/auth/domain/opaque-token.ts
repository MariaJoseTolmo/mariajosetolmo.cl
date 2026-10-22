/** Anything that yields random bytes (the `RandomSource` port fits). */
export interface ByteSource {
  bytes(length: number): Uint8Array;
}

const TOKEN_BYTES = 32;
// 32 bytes in base64url without padding is exactly 43 characters.
const PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Magic-link and refresh tokens share one opaque shape: 256 random bits. */
export function generateOpaqueToken(random: ByteSource): string {
  return Buffer.from(random.bytes(TOKEN_BYTES)).toString('base64url');
}

export function isOpaqueToken(value: unknown): value is string {
  // `$` also matches before a final newline, so the length is checked too.
  return (
    typeof value === 'string' && value.length === 43 && PATTERN.test(value)
  );
}
