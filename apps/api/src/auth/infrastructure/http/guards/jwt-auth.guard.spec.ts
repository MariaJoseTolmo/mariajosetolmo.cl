import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { handlerOf } from '../../../../../test/support/handler-of';
import { FakeClock } from '../../../../../test/support/fakes/fake-clock';
import { testConfig } from '../../../../../test/support/test-config';
import type { Principal } from '../../../../identity/domain/principal';
import type { AccessTokenVerifier } from '../../../application/ports/access-token.port';
import { Public } from '../../../../shared/infrastructure/http/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class Routes {
  protected_(): void {}

  @Public()
  open(): void {}
}

@Public()
class PublicRoutes {
  inherited(): void {}
}

interface TestRequest {
  cookies?: Record<string, string>;
  principal?: Principal;
}

class FakeVerifier implements AccessTokenVerifier {
  readonly seenAt: Date[] = [];

  constructor(private readonly known: Record<string, Principal>) {}

  verify(jwt: string, now: Date): Promise<Principal | null> {
    this.seenAt.push(now);
    return Promise.resolve(this.known[jwt] ?? null);
  }
}

const PRINCIPAL: Principal = { userId: 'user-1', role: 'RECRUITER' };

function contextFor(
  req: TestRequest,
  handler: () => void,
  controller: new () => object,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

function build(cookieSecure = true): {
  guard: JwtAuthGuard;
  verifier: FakeVerifier;
  clock: FakeClock;
} {
  const verifier = new FakeVerifier({ 'good.jwt.token': PRINCIPAL });
  const clock = new FakeClock();
  const guard = new JwtAuthGuard(
    new Reflector(),
    verifier,
    clock,
    testConfig({ cookieSecure }),
  );
  return { guard, verifier, clock };
}

const securedContext = (req: TestRequest): ExecutionContext =>
  contextFor(req, handlerOf(Routes, 'protected_'), Routes);

describe('JwtAuthGuard', () => {
  it('lets a valid access cookie through and attaches the principal', async () => {
    const { guard } = build();
    const req: TestRequest = { cookies: { '__Host-access': 'good.jwt.token' } };
    await expect(guard.canActivate(securedContext(req))).resolves.toBe(true);
    expect(req.principal).toEqual(PRINCIPAL);
  });

  it('verifies against the injected clock, not the system time', async () => {
    const { guard, verifier, clock } = build();
    await guard.canActivate(
      securedContext({ cookies: { '__Host-access': 'good.jwt.token' } }),
    );
    expect(verifier.seenAt).toEqual([clock.now()]);
  });

  it.each([
    ['no cookies at all', {}],
    ['cookie-parser found nothing', { cookies: {} }],
    ['an unknown token', { cookies: { '__Host-access': 'forged.jwt.token' } }],
    ['an empty cookie', { cookies: { '__Host-access': '' } }],
    ['the wrong cookie name', { cookies: { access: 'good.jwt.token' } }],
  ])('answers 401 with %s', async (_name, req: TestRequest) => {
    const { guard } = build();
    await expect(guard.canActivate(securedContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(req.principal).toBeUndefined();
  });

  it('reads the unprefixed cookie when Secure is off', async () => {
    const { guard } = build(false);
    const req: TestRequest = { cookies: { access: 'good.jwt.token' } };
    await expect(guard.canActivate(securedContext(req))).resolves.toBe(true);
    expect(req.principal).toEqual(PRINCIPAL);
  });

  it('skips verification on a @Public() handler', async () => {
    const { guard, verifier } = build();
    const ctx = contextFor({}, handlerOf(Routes, 'open'), Routes);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifier.seenAt).toHaveLength(0);
  });

  it('skips verification on a @Public() controller', async () => {
    const { guard } = build();
    const ctx = contextFor(
      {},
      handlerOf(PublicRoutes, 'inherited'),
      PublicRoutes,
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
