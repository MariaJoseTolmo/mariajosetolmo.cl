import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../../shared/infrastructure/http/roles.decorator';
import type { VisitRow } from '../../../visits/application/ports/visit-repository.port';
import { ListVisits } from '../../application/list-visits.use-case';
import type { VisitItemDto, VisitsPageDto } from './dto/visits-page.dto';

const VISITS_PATH = '/api/v1/admin/visits';

/** The public shape: the recruiter's profile is nested, no user id leaves. */
function toItem(row: VisitRow): VisitItemDto {
  return {
    id: row.id,
    kind: row.kind,
    occurredAt: row.occurredAt.toISOString(),
    recruiter: { company: row.company, name: row.name },
  };
}

// Hidden from Swagger on purpose: /admin must not be advertised.
@ApiExcludeController()
@Roles('ADMIN')
@Controller('v1/admin/visits')
export class AdminVisitsController {
  constructor(@Inject(ListVisits) private readonly listVisits: ListVisits) {}

  @Get()
  async visits(
    @Query('limit') limit?: unknown,
    @Query('cursor') cursor?: unknown,
    @Query('kind') kind?: unknown,
  ): Promise<VisitsPageDto> {
    const page = await this.listVisits.execute({ limit, cursor, kind });
    // base64url needs no escaping; limit and kind are validated values.
    const filter = page.kind === null ? '' : `&kind=${page.kind}`;
    const next =
      page.nextCursor === null
        ? null
        : `${VISITS_PATH}?cursor=${page.nextCursor}&limit=${page.limit}${filter}`;
    return { items: page.items.map(toItem), next };
  }
}
