import { randomBytes } from 'node:crypto';
import type { RandomSource } from '../application/ports/random-source.port';

export class CryptoRandomSource implements RandomSource {
  bytes(length: number): Uint8Array {
    return new Uint8Array(randomBytes(length));
  }
}
