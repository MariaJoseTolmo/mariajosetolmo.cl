import type { Availability } from '../../domain/availability';
import type { AvailabilityRepository } from '../../application/ports/availability-repository.port';

const PLACEHOLDER = '[dato de ejemplo]';

/** Stand-in until the Postgres repository lands; placeholders only. */
export class InMemoryAvailabilityRepository implements AvailabilityRepository {
  constructor(
    private current: Availability = {
      modality: PLACEHOLDER,
      start: PLACEHOLDER,
      salary: PLACEHOLDER,
    },
  ) {}

  set(availability: Availability): void {
    this.current = availability;
  }

  get(): Promise<Availability> {
    return Promise.resolve(this.current);
  }
}
