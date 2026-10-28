import { Inject, Injectable } from '@nestjs/common';
import type { SkillGroup } from '../domain/skill-group';
import { SkillLevel } from '../domain/skill-level';
import {
  CONTENT_REPOSITORY,
  type ContentRepository,
} from './ports/content-repository.port';

export interface ListSkillsInput {
  readonly level?: unknown;
}

export type SkillsResult = SkillGroup | { readonly levels: SkillGroup[] };

@Injectable()
export class ListSkills {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly content: ContentRepository,
  ) {}

  async execute(input: ListSkillsInput): Promise<SkillsResult> {
    const level = SkillLevel.parse(input.level);
    const groups = await this.content.listSkills(level);
    const [first] = groups;
    if (level !== null && first) return first;
    return { levels: groups };
  }
}
