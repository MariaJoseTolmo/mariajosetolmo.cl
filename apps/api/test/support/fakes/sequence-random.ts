import type { RandomSource } from '../../../src/shared/application/ports/random-source.port';

/** Deterministic and never repeating: the n-th call fills with the byte n. */
export class SequenceRandomSource implements RandomSource {
  private calls = 0;

  bytes(length: number): Uint8Array {
    this.calls += 1;
    return new Uint8Array(length).fill(this.calls);
  }
}
