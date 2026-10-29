import {
  CdnRequired,
  DomainError,
  InfrastructureUnavailable,
  InvalidToken,
  OriginNotAllowed,
  RoleNotAllowed,
  RateLimited,
  InvalidInput,
  Unauthenticated,
} from './errors';

describe('domain errors', () => {
  it('InvalidInput is a DomainError with a stable code and message', () => {
    const error = new InvalidInput('email is malformed');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('INVALID_INPUT');
    expect(error.message).toBe('email is malformed');
    expect(error.name).toBe('InvalidInput');
  });

  it('InfrastructureUnavailable keeps the cause but exposes a generic message', () => {
    const cause = new Error('connect ECONNREFUSED 10.0.0.1:6379');
    const error = new InfrastructureUnavailable(cause);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INFRASTRUCTURE_UNAVAILABLE');
    expect(error.message).toBe('Service temporarily unavailable');
    expect(error.message).not.toContain('ECONNREFUSED');
    expect(error.cause).toBe(cause);
  });

  it('InfrastructureUnavailable works without a cause', () => {
    expect(new InfrastructureUnavailable().cause).toBeUndefined();
  });

  it.each([
    [new InvalidToken('token is invalid'), 'INVALID_TOKEN'],
    [new CdnRequired(), 'CDN_REQUIRED'],
    [new OriginNotAllowed(), 'ORIGIN_NOT_ALLOWED'],
    [new RoleNotAllowed(), 'ROLE_NOT_ALLOWED'],
  ])('%p is a DomainError with its own code %s', (error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.name).toBe(error.constructor.name);
  });

  it('keeps fixed generic messages on the 403 errors', () => {
    expect(new CdnRequired().message).toBe(
      'Request did not come through the CDN',
    );
    expect(new OriginNotAllowed().message).toBe('Origin not allowed');
    expect(new RoleNotAllowed().message).toBe('Role not allowed');
  });

  it('no longer exports the generic Forbidden error', async () => {
    const mod: Record<string, unknown> = await import('./errors');
    expect(mod['Forbidden']).toBeUndefined();
  });

  it('Unauthenticated is a DomainError with its own code', () => {
    const error = new Unauthenticated();
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.message).toBe('Authentication required');
  });

  it('RateLimited carries when to retry and a generic message', () => {
    const error = new RateLimited(120);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(120);
    expect(error.message).toBe('Too many requests');
  });
});
