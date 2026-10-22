import type { IdGenerator } from '../../../src/shared/application/ports/id-generator.port';

export class SequenceIdGenerator implements IdGenerator {
  private n = 0;

  uuid(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}
