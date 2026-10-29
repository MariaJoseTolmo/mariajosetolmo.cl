/** Every domain error code; the HTTP layer must map each one (exhaustively). */
export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TOKEN'
  | 'UNAUTHENTICATED'
  | 'CDN_REQUIRED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'ROLE_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'INFRASTRUCTURE_UNAVAILABLE';

/** Base for errors the HTTP layer translates into a status (see design 11). */
export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

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

/** A token or link is unusable. One code for every cause: nothing leaks. */
export class InvalidToken extends DomainError {
  readonly code = 'INVALID_TOKEN';
}

/** Production request without the CDN's viewer-address signal. */
export class CdnRequired extends DomainError {
  readonly code = 'CDN_REQUIRED';

  constructor() {
    super('Request did not come through the CDN');
  }
}

/** A mutating request from an Origin that is not on the allow-list. */
export class OriginNotAllowed extends DomainError {
  readonly code = 'ORIGIN_NOT_ALLOWED';

  constructor() {
    super('Origin not allowed');
  }
}

/** The caller is authenticated but their role may not use the resource. */
export class RoleNotAllowed extends DomainError {
  readonly code = 'ROLE_NOT_ALLOWED';

  constructor() {
    super('Role not allowed');
  }
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
