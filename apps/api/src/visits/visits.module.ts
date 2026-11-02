import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../shared/infrastructure/persistence/data-source.factory';
import { VISIT_RECORDER } from './application/ports/visit-recorder.port';
import { VISIT_REPOSITORY } from './application/ports/visit-repository.port';
import { RecordVisit } from './application/record-visit.service';
import { TypeOrmVisitRepository } from './infrastructure/persistence/typeorm-visit.repository';

@Module({
  providers: [
    {
      provide: VISIT_REPOSITORY,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmVisitRepository(dataSource),
      inject: [DATA_SOURCE],
    },
    RecordVisit,
    { provide: VISIT_RECORDER, useExisting: RecordVisit },
  ],
  exports: [VISIT_RECORDER, VISIT_REPOSITORY],
})
export class VisitsModule {}
