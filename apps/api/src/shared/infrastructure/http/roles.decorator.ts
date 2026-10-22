import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../../identity/domain/role';

export const ROLES_KEY = 'roles';

/** Restricts a route to the listed roles; enforced by RolesGuard. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
