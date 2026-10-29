import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { handlerOf } from '../../../../../test/support/handler-of';
import {
  RoleNotAllowed,
  Unauthenticated,
} from '../../../../shared/domain/errors';
import type { Principal } from '../../../../identity/domain/principal';
import { Roles } from '../../../../shared/infrastructure/http/roles.decorator';
import { RolesGuard } from './roles.guard';

class Routes {
  unrestricted(): void {}

  @Roles('ADMIN')
  adminOnly(): void {}

  @Roles('RECRUITER', 'ADMIN')
  anyRole(): void {}
}

function contextFor(
  principal: Principal | undefined,
  handler: () => void,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
    getHandler: () => handler,
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());
const recruiter: Principal = { userId: 'u1', role: 'RECRUITER' };
const admin: Principal = { userId: 'u2', role: 'ADMIN' };

describe('RolesGuard', () => {
  it('lets anyone through a route without @Roles', () => {
    expect(
      guard.canActivate(
        contextFor(recruiter, handlerOf(Routes, 'unrestricted')),
      ),
    ).toBe(true);
  });

  it('answers 403 when the role is not in the list', () => {
    expect(() =>
      guard.canActivate(contextFor(recruiter, handlerOf(Routes, 'adminOnly'))),
    ).toThrow(RoleNotAllowed);
  });

  it('allows a role that is in the list', () => {
    expect(
      guard.canActivate(contextFor(admin, handlerOf(Routes, 'adminOnly'))),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor(recruiter, handlerOf(Routes, 'anyRole'))),
    ).toBe(true);
  });

  it('answers 401 if a restricted route somehow has no principal', () => {
    expect(() =>
      guard.canActivate(contextFor(undefined, handlerOf(Routes, 'adminOnly'))),
    ).toThrow(Unauthenticated);
  });
});
