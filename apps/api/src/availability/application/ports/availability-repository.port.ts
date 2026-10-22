import type { Availability } from '../../domain/availability';

export interface AvailabilityRepository {
  get(): Promise<Availability>;
}

export const AVAILABILITY_REPOSITORY = Symbol('AVAILABILITY_REPOSITORY');
