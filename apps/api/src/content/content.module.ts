import { Module } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../shared/infrastructure/persistence/data-source.factory';
import { GetProfile } from './application/get-profile.use-case';
import { ListExperience } from './application/list-experience.use-case';
import { ListSkills } from './application/list-skills.use-case';
import { CONTENT_REPOSITORY } from './application/ports/content-repository.port';
import { ContentController } from './infrastructure/http/content.controller';
import { TypeOrmContentRepository } from './infrastructure/persistence/typeorm-content.repository';

@Module({
  controllers: [ContentController],
  providers: [
    GetProfile,
    ListExperience,
    ListSkills,
    {
      provide: CONTENT_REPOSITORY,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmContentRepository(dataSource),
      inject: [DATA_SOURCE],
    },
  ],
})
export class ContentModule {}
