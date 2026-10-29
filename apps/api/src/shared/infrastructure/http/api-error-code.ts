/**
 * Stable public error codes. The client decides its copy from these, never
 * from `message`. The web keeps a mirror list; a contract test compares both.
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

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
