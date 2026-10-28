import { Module } from '@nestjs/common';
import { GetProfile } from './application/get-profile.use-case';
import { ListExperience } from './application/list-experience.use-case';
import { ListSkills } from './application/list-skills.use-case';
import { CONTENT_REPOSITORY } from './application/ports/content-repository.port';
import { ContentController } from './infrastructure/http/content.controller';
import { InMemoryContentRepository } from './infrastructure/persistence/in-memory-content.repository';

@Module({
  controllers: [ContentController],
  providers: [
    GetProfile,
    ListExperience,
    ListSkills,
    // Empty stand-in until the Postgres adapter is wired (design E7).
    {
      provide: CONTENT_REPOSITORY,
      useFactory: () => new InMemoryContentRepository(),
    },
  ],
})
export class ContentModule {}
