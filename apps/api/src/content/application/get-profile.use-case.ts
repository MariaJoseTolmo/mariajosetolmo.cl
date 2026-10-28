import { Inject, Injectable } from '@nestjs/common';
import type { Profile } from '../domain/profile';
import {
  CONTENT_REPOSITORY,
  type ContentRepository,
} from './ports/content-repository.port';

@Injectable()
export class GetProfile {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly content: ContentRepository,
  ) {}

  execute(): Promise<Profile> {
    return this.content.getProfile();
  }
}
