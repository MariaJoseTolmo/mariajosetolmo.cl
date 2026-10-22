import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { GetMe } from './application/get-me.use-case';
import { USER_REPOSITORY } from './application/ports/user-repository.port';
import { MeController } from './infrastructure/http/me.controller';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory-user.repository';

@Module({
  imports: [AvailabilityModule],
  controllers: [MeController],
  providers: [
    GetMe,
    {
      provide: USER_REPOSITORY,
      useFactory: () => new InMemoryUserRepository(),
    },
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule {}
