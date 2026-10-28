import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { GetProfile } from '../../application/get-profile.use-case';
import { ListExperience } from '../../application/list-experience.use-case';
import { ListSkills } from '../../application/list-skills.use-case';
import type { ExperienceEntry } from '../../domain/experience-entry';
import { SKILL_LEVELS } from '../../domain/skill-level';
import {
  ExperienceItemDto,
  ExperiencePageDto,
} from './dto/experience-page.dto';
import { ProfileDto } from './dto/profile.dto';
import { SkillGroupDto, SkillLevelsDto } from './dto/skills.dto';

const EXPERIENCE_PATH = '/api/v1/experience';

/** Drops `position`: it is the keyset, not part of the public shape. */
function toItem(entry: ExperienceEntry): ExperienceItemDto {
  return {
    id: entry.id,
    company: entry.company,
    role: entry.role,
    sector: entry.sector,
    period: entry.period,
    highlights: [...entry.highlights],
    technologies: [...entry.technologies],
  };
}

@ApiTags('content')
@ApiCookieAuth('access-cookie')
@Controller('v1')
export class ContentController {
  constructor(
    @Inject(GetProfile) private readonly getProfile: GetProfile,
    @Inject(ListExperience) private readonly listExperience: ListExperience,
    @Inject(ListSkills) private readonly listSkills: ListSkills,
  ) {}

  @Get('profile')
  @ApiOkResponse({ type: ProfileDto })
  async profile(): Promise<ProfileDto> {
    const profile = await this.getProfile.execute();
    return {
      name: profile.name,
      role: profile.role,
      architecture: profile.architecture,
      domains: [...profile.domains],
      openToWork: profile.openToWork,
    };
  }

  @Get('experience')
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    schema: { type: 'integer', minimum: 0 },
  })
  @ApiOkResponse({ type: ExperiencePageDto })
  async experience(
    @Query('limit') limit?: unknown,
    @Query('cursor') cursor?: unknown,
  ): Promise<ExperiencePageDto> {
    const page = await this.listExperience.execute({ limit, cursor });
    const next =
      page.nextCursor === null
        ? null
        : `${EXPERIENCE_PATH}?cursor=${page.nextCursor}&limit=${page.limit}`;
    return { items: page.items.map(toItem), next };
  }

  @Get('skills')
  @ApiExtraModels(SkillGroupDto, SkillLevelsDto)
  @ApiQuery({ name: 'level', required: false, enum: SKILL_LEVELS })
  @ApiOkResponse({
    description: 'One group with `level`, or the four groups under `levels`.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SkillGroupDto) },
        { $ref: getSchemaPath(SkillLevelsDto) },
      ],
    },
  })
  async skills(
    @Query('level') level?: unknown,
  ): Promise<SkillGroupDto | SkillLevelsDto> {
    const result = await this.listSkills.execute({ level });
    if ('levels' in result) {
      return {
        levels: result.levels.map((g) => ({
          level: g.level,
          skills: [...g.skills],
        })),
      };
    }
    return { level: result.level, skills: [...result.skills] };
  }
}
