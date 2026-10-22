import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../shared/infrastructure/persistence/data-source.factory';
import { AvailabilityModule } from '../availability/availability.module';
import { GetMe } from './application/get-me.use-case';
import { USER_REPOSITORY } from './application/ports/user-repository.port';
import { MeController } from './infrastructure/http/me.controller';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';

@Module({
  imports: [AvailabilityModule],
  controllers: [MeController],
  providers: [
    GetMe,
    {
      provide: USER_REPOSITORY,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmUserRepository(dataSource),
      inject: [DATA_SOURCE],
    },
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule {}
