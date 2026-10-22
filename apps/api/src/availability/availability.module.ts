import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../shared/infrastructure/persistence/data-source.factory';
import { AVAILABILITY_REPOSITORY } from './application/ports/availability-repository.port';
import { TypeOrmAvailabilityRepository } from './infrastructure/persistence/typeorm-availability.repository';

@Module({
  providers: [
    {
      provide: AVAILABILITY_REPOSITORY,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmAvailabilityRepository(dataSource),
      inject: [DATA_SOURCE],
    },
  ],
  exports: [AVAILABILITY_REPOSITORY],
})
export class AvailabilityModule {}
