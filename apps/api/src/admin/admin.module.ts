import { Module } from '@nestjs/common';
import { VisitsModule } from '../visits/visits.module';
import { ListVisits } from './application/list-visits.use-case';
import { AdminVisitsController } from './infrastructure/http/admin-visits.controller';

@Module({
  imports: [VisitsModule],
  controllers: [AdminVisitsController],
  providers: [ListVisits],
})
export class AdminModule {}
