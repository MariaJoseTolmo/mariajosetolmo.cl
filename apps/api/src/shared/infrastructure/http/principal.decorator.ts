import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Principal } from '../../../identity/domain/principal';

export interface PrincipalRequest {
  principal?: Principal;
}

/** The verified caller set by JwtAuthGuard. Only usable on guarded routes. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context
      .switchToHttp()
      .getRequest<PrincipalRequest>().principal;
    if (!principal) throw new Error('CurrentPrincipal used on a public route');
    return principal;
  },
);
