/** Base for errors the HTTP layer translates into a status (see design 11). */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidInput extends DomainError {
  readonly code = 'INVALID_INPUT';
}

/** A store (Redis, Postgres) failed: callers fail closed with 503. */
export class InfrastructureUnavailable extends DomainError {
  readonly code = 'INFRASTRUCTURE_UNAVAILABLE';

  constructor(cause?: unknown) {
    // The cause may contain hosts or credentials: keep it off the message.
    super('Service temporarily unavailable', { cause });
  }
}

export class Forbidden extends DomainError {
  readonly code = 'FORBIDDEN';
}

/** The caller has no valid identity (for example a deleted user's session). */
export class Unauthenticated extends DomainError {
  readonly code = 'UNAUTHENTICATED';

  constructor() {
    super('Authentication required');
  }
}

/** A per-IP limit was exceeded: the HTTP layer answers 429 with Retry-After. */
export class RateLimited extends DomainError {
  readonly code = 'RATE_LIMITED';

  constructor(readonly retryAfterSeconds: number) {
    super('Too many requests');
  }
}
