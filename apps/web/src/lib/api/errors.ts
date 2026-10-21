import type { ApiErrorKind, ApiResult } from './types';

/** `verify` treats rejected tokens (expired, used, malformed) as one kind. */
export type ErrorContext = 'default' | 'verify';

const INVALID_TOKEN_STATUSES = new Set([400, 401, 410]);

/** The single place where an HTTP status becomes an `ApiErrorKind`. */
export function errorFromStatus(
  status: number,
  context: ErrorContext = 'default',
): ApiErrorKind {
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  if (context === 'verify') {
    return INVALID_TOKEN_STATUSES.has(status) ? 'invalid-token' : 'unexpected';
  }
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  return 'unexpected';
}

export function failure(
  error: ApiErrorKind,
  status?: number,
): ApiResult<never> {
  return status === undefined
    ? { ok: false, error }
    : { ok: false, error, status };
}
