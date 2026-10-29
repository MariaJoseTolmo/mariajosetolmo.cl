/**
 * Mirror of the API's stable public error codes. The web cannot import the
 * API, so a contract test (`error-codes.test.ts`) keeps both lists identical.
 * Keep this module free of imports.
 */
export const API_ERROR_CODES = [
  'INVALID_INPUT',
  'INVALID_TOKEN',
  'UNAUTHENTICATED',
  'CDN_REQUIRED',
  'ORIGIN_NOT_ALLOWED',
  'ROLE_NOT_ALLOWED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorReason = (typeof API_ERROR_CODES)[number];
