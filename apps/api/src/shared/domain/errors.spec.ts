import {
  DomainError,
  Forbidden,
  InfrastructureUnavailable,
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

  it('Forbidden is a DomainError with its own code', () => {
    const error = new Forbidden('request did not come through CloudFront');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.name).toBe('Forbidden');
    expect(error.message).toBe('request did not come through CloudFront');
  });

  it('Unauthenticated is a DomainError with its own code', () => {
    const error = new Unauthenticated();
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.message).toBe('Authentication required');
  });
});
