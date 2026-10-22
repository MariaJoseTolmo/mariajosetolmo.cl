import { Controller, Get, Inject } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../../shared/infrastructure/http/roles.decorator';
import { ListVisits } from '../../application/list-visits.use-case';

// Hidden from Swagger on purpose: /admin must not be advertised.
@ApiExcludeController()
@Roles('ADMIN')
@Controller('v1/admin/visits')
export class AdminVisitsController {
  constructor(@Inject(ListVisits) private readonly listVisits: ListVisits) {}

  @Get()
  visits(): never[] {
    return this.listVisits.execute();
  }
}
