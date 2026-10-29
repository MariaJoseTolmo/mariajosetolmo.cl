import { API_ERROR_CODES, type ApiErrorReason } from './error-codes';
import type { ApiErrorKind, ApiFailure, ApiResult } from './types';

/** `verify` treats rejected tokens (expired, used, malformed) as one kind. */
export type ErrorContext = 'default' | 'verify';

const INVALID_TOKEN_STATUSES = new Set([400, 401, 410]);
const INVALID_INPUT_STATUSES = new Set([400, 413, 422]);
const MAX_RETRY_AFTER_SECONDS = 86400;

const KIND_BY_REASON: Record<ApiErrorReason, ApiErrorKind> = {
  INVALID_INPUT: 'invalid-input',
  INVALID_TOKEN: 'invalid-token',
  UNAUTHENTICATED: 'unauthorized',
  CDN_REQUIRED: 'forbidden',
  ORIGIN_NOT_ALLOWED: 'forbidden',
  ROLE_NOT_ALLOWED: 'forbidden',
  NOT_FOUND: 'unexpected',
  RATE_LIMITED: 'rate-limited',
  SERVICE_UNAVAILABLE: 'server',
  INTERNAL_ERROR: 'server',
};

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
  if (INVALID_INPUT_STATUSES.has(status)) return 'invalid-input';
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

/** Seconds only (1..86400); dates, zero, negatives and junk give `undefined`. */
export function parseRetryAfter(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const seconds = Number(raw);
  return seconds >= 1 && seconds <= MAX_RETRY_AFTER_SECONDS
    ? seconds
    : undefined;
}

const isReason = (value: unknown): value is ApiErrorReason =>
  API_ERROR_CODES.some((code) => code === value);

function reasonOf(body: unknown): ApiErrorReason | undefined {
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined;
  }
  return isReason(body.code) ? body.code : undefined;
}

export interface RawFailure {
  status: number;
  body: unknown;
  retryAfter: string | null;
}

/**
 * Turns an error response into an `ApiFailure`. The `code` wins over the
 * status; without a catalog `code` there is no `reason` and the kind comes
 * from the status. Never throws.
 */
export function toApiFailure(
  { status, body, retryAfter }: RawFailure,
  context: ErrorContext = 'default',
): ApiFailure {
  const reason = reasonOf(body);
  const result: ApiFailure = {
    error: reason ? KIND_BY_REASON[reason] : errorFromStatus(status, context),
    status,
  };
  if (reason) result.reason = reason;
  const wait = status === 429 ? parseRetryAfter(retryAfter) : undefined;
  if (wait !== undefined) result.retryAfterSeconds = wait;
  return result;
}
