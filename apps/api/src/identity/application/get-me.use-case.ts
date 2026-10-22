import { Inject, Injectable } from '@nestjs/common';
import {
  AVAILABILITY_REPOSITORY,
  type AvailabilityRepository,
} from '../../availability/application/ports/availability-repository.port';
import type { Availability } from '../../availability/domain/availability';
import { Unauthenticated } from '../../shared/domain/errors';
import type { Principal } from '../domain/principal';
import type { Role } from '../domain/role';
import {
  USER_REPOSITORY,
  type UserRepository,
} from './ports/user-repository.port';

export interface Me {
  readonly email: string;
  readonly role: Role;
  readonly company: string | null;
  readonly name: string | null;
  readonly availability: Availability;
}

@Injectable()
export class GetMe {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AVAILABILITY_REPOSITORY)
    private readonly availability: AvailabilityRepository,
  ) {}

  async execute(principal: Principal): Promise<Me> {
    const user = await this.users.findById(principal.userId);
    if (!user) throw new Unauthenticated();
    return {
      email: user.email.value,
      role: user.role,
      company: user.company,
      name: user.name,
      availability: await this.availability.get(),
    };
  }
}
