import { Module } from '@nestjs/common';
import { ListVisits } from './application/list-visits.use-case';
import { AdminVisitsController } from './infrastructure/http/admin-visits.controller';

@Module({ controllers: [AdminVisitsController], providers: [ListVisits] })
export class AdminModule {}
