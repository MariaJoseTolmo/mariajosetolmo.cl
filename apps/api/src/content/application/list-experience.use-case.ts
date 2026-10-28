import { Inject, Injectable } from '@nestjs/common';
import { ExperienceCursor } from '../domain/experience-cursor';
import type { ExperienceEntry } from '../domain/experience-entry';
import { PageLimit } from '../domain/page-limit';
import {
  CONTENT_REPOSITORY,
  type ContentRepository,
} from './ports/content-repository.port';

export interface ListExperienceInput {
  readonly limit?: unknown;
  readonly cursor?: unknown;
}

export interface ExperiencePage {
  readonly items: ExperienceEntry[];
  readonly limit: number;
  /** Position to resume after, or `null` on the last page. */
  readonly nextCursor: number | null;
}

@Injectable()
export class ListExperience {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly content: ContentRepository,
  ) {}

  async execute(input: ListExperienceInput): Promise<ExperiencePage> {
    const limit = PageLimit.parse(input.limit).value;
    const cursor = ExperienceCursor.parse(input.cursor).value;
    // The repository returns one extra row when another page exists.
    const rows = await this.content.listExperience(cursor, limit);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor = rows.length > limit && last ? last.position : null;
    return { items, limit, nextCursor };
  }
}
