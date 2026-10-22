import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../application/ports/id-generator.port';

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}
