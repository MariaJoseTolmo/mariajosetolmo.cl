import { Module } from '@nestjs/common';
import { AVAILABILITY_REPOSITORY } from './application/ports/availability-repository.port';
import { InMemoryAvailabilityRepository } from './infrastructure/persistence/in-memory-availability.repository';

@Module({
  providers: [
    {
      provide: AVAILABILITY_REPOSITORY,
      useFactory: () => new InMemoryAvailabilityRepository(),
    },
  ],
  exports: [AVAILABILITY_REPOSITORY],
})
export class AvailabilityModule {}
