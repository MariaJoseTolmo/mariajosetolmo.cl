import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../../../identity/domain/role';
import type { PrincipalRequest } from '../../../../shared/infrastructure/http/principal.decorator';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed) return true;
    const principal = context
      .switchToHttp()
      .getRequest<PrincipalRequest>().principal;
    if (!principal) throw new UnauthorizedException();
    if (!allowed.includes(principal.role)) throw new ForbiddenException();
    return true;
  }
}
