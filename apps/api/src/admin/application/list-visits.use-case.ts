import { Inject, Injectable } from '@nestjs/common';
import { PageLimit } from '../../shared/domain/page-limit';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
  type VisitRow,
} from '../../visits/application/ports/visit-repository.port';
import { VisitCursor } from '../../visits/domain/visit-cursor';
import {
  parseKindFilter,
  VISIT_KINDS,
  type VisitKind,
} from '../../visits/domain/visit-kind';
import { retainFrom } from '../../visits/domain/visit-retention';

export interface ListVisitsInput {
  readonly limit?: unknown;
  readonly cursor?: unknown;
  readonly kind?: unknown;
}

export interface VisitPage {
  readonly items: VisitRow[];
  readonly limit: number;
  readonly kind: VisitKind | null;
  readonly nextCursor: string | null;
}

@Injectable()
export class ListVisits {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: ListVisitsInput): Promise<VisitPage> {
    const limit = PageLimit.parse(input.limit).value;
    const kind = parseKindFilter(input.kind);
    const cursor =
      input.cursor === undefined
        ? null
        : VisitCursor.parseOrThrow(input.cursor);
    // One extra row tells whether another page exists.
    const rows = await this.visits.listPage({
      retainFrom: retainFrom(this.clock.now()),
      kinds: kind === null ? VISIT_KINDS : [kind],
      before: cursor && { occurredAt: cursor.occurredAt, id: cursor.id },
      limit: limit + 1,
    });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > limit && last ? VisitCursor.from(last).encode() : null;
    return { items, limit, kind, nextCursor };
  }
}
