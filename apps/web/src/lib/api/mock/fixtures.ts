import { parseRetryAfter } from '../errors';
import { API_ERROR_CODES, type ApiErrorReason } from '../error-codes';
import type { Me, PlaygroundEndpoint } from '../types';

/**
 * Unique string that must never reach `out/` in an http build. It is part of
 * the profile returned by `getMe`, so the minifier cannot drop it.
 */
export const MOCK_MARKER = '__WEB_CV_MOCK__';

export const SESSION_KEY = 'web-cv-mock-session';

/** Every value is an obvious placeholder: no real personal data lives here. */
export const MOCK_ME: Me = {
  email: 'reclutadora@example.com',
  role: 'RECRUITER',
  company: '[EMPRESA]',
  name: `[NOMBRE] ${MOCK_MARKER}`,
  availability: {
    modality: '[MODALIDAD]',
    start: '[INICIO]',
    salary: '[RENTA]',
  },
};

export const MOCK_CV_LINK = {
  url: 'https://example.invalid/[cv-de-ejemplo]',
  expiresAt: '2000-01-01T00:00:00.000Z',
};

export const MOCK_BODIES: Record<
  Exclude<PlaygroundEndpoint, '/api/v1/admin/visits'>,
  unknown
> = {
  '/api/v1/profile': { name: '[NOMBRE]', title: '[CARGO]' },
  '/api/v1/experience?limit=2': [
    { company: '[EMPRESA 1]', role: '[ROL]' },
    { company: '[EMPRESA 2]', role: '[ROL]' },
  ],
  '/api/v1/skills?level=advanced': [{ name: '[HABILIDAD]', level: 'advanced' }],
  '/api/v1/me': MOCK_ME,
};

/** Same shape as the real API: four keys, a stable `code`. */
export const MOCK_FORBIDDEN_BODY = {
  statusCode: 403,
  error: 'Forbidden',
  message: 'Forbidden resource',
  code: 'ROLE_NOT_ALLOWED',
} as const;

/** One-shot error injection: `"<CODE>"` or `"RATE_LIMITED:<seconds>"`. */
export const ERROR_KEY = 'web-cv-mock-error';

export const MOCK_STATUS_BY_CODE: Record<ApiErrorReason, number> = {
  INVALID_INPUT: 400,
  INVALID_TOKEN: 400,
  UNAUTHENTICATED: 401,
  CDN_REQUIRED: 403,
  ORIGIN_NOT_ALLOWED: 403,
  ROLE_NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/** The four-key body the real API sends for an injected code. */
export function injectedBody(code: ApiErrorReason) {
  const statusCode = MOCK_STATUS_BY_CODE[code];
  const error = STATUS_TEXT[statusCode] ?? 'Error';
  return { statusCode, error, message: 'Mock error', code };
}

export interface InjectedError {
  code: ApiErrorReason;
  retryAfter: string | null;
}

/** Parses the injection value; anything else is ignored (`undefined`). */
export function parseInjectedError(raw: string): InjectedError | undefined {
  const [code, seconds, ...rest] = raw.split(':');
  const known = API_ERROR_CODES.find((candidate) => candidate === code);
  if (!known || rest.length > 0) return undefined;
  if (seconds === undefined) return { code: known, retryAfter: null };
  return known === 'RATE_LIMITED' && parseRetryAfter(seconds) !== undefined
    ? { code: known, retryAfter: seconds }
    : undefined;
}
