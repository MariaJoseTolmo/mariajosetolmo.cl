import {
  errorFromStatus,
  failure,
  parseRetryAfter,
  toApiFailure,
} from './errors';
import { API_ERROR_CODES } from './error-codes';
import type { ApiErrorKind } from './types';

describe('errorFromStatus', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [429, 'rate-limited'],
    [500, 'server'],
    [503, 'server'],
    [404, 'unexpected'],
    [302, 'unexpected'],
  ] as const)('maps %i to %s by default', (status, kind) => {
    expect(errorFromStatus(status)).toBe(kind);
  });

  it.each([
    [400, 'invalid-token'],
    [401, 'invalid-token'],
    [410, 'invalid-token'],
    [429, 'rate-limited'],
    [502, 'server'],
    [404, 'unexpected'],
  ] as const)('maps %i to %s when verifying a token', (status, kind) => {
    expect(errorFromStatus(status, 'verify')).toBe(kind);
  });
});

describe('failure', () => {
  it('builds a failed result carrying the status when there is one', () => {
    expect(failure('server', 503)).toEqual({
      ok: false,
      error: 'server',
      status: 503,
    });
  });

  it('omits the status for errors without a response', () => {
    expect(failure('network')).toEqual({ ok: false, error: 'network' });
  });
});

describe('parseRetryAfter', () => {
  it.each([
    ['120', 120],
    ['1', 1],
    ['86400', 86400],
    ['abc', undefined],
    ['Wed, 21 Oct 2026 07:28:00 GMT', undefined],
    ['0', undefined],
    ['-5', undefined],
    ['86401', undefined],
    ['2.5', undefined],
    ['', undefined],
    [null, undefined],
  ] as const)('parses %p as %p', (raw, expected) => {
    expect(parseRetryAfter(raw)).toBe(expected);
  });
});

const input = (
  status: number,
  body: unknown,
  retryAfter: string | null = null,
) => ({
  status,
  body,
  retryAfter,
});

const CODE_CASES = [
  ['INVALID_INPUT', 400, 'invalid-input'],
  ['INVALID_TOKEN', 400, 'invalid-token'],
  ['UNAUTHENTICATED', 401, 'unauthorized'],
  ['CDN_REQUIRED', 403, 'forbidden'],
  ['ORIGIN_NOT_ALLOWED', 403, 'forbidden'],
  ['ROLE_NOT_ALLOWED', 403, 'forbidden'],
  ['NOT_FOUND', 404, 'unexpected'],
  ['RATE_LIMITED', 429, 'rate-limited'],
  ['SERVICE_UNAVAILABLE', 503, 'server'],
  ['INTERNAL_ERROR', 500, 'server'],
] as const;

describe('toApiFailure', () => {
  it('lets the code win over the status', () => {
    expect(toApiFailure(input(403, { code: 'ROLE_NOT_ALLOWED' }))).toEqual({
      error: 'forbidden',
      status: 403,
      reason: 'ROLE_NOT_ALLOWED',
    });
  });

  it.each(CODE_CASES)('maps code %s to kind %s', (code, status, kind) => {
    expect(toApiFailure(input(status, { code }))).toEqual({
      error: kind,
      status,
      reason: code,
    });
  });

  it('covers every catalog code exactly once', () => {
    const codes = CODE_CASES.map(([code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set<string>(codes)).toEqual(new Set<string>(API_ERROR_CODES));
  });

  it('falls back to the status without a code', () => {
    expect(toApiFailure(input(429, { statusCode: 429 }))).toEqual({
      error: 'rate-limited',
      status: 429,
    });
  });

  it('produces no reason for an HTML 403', () => {
    expect(toApiFailure(input(403, '<html>blocked</html>'))).toEqual({
      error: 'forbidden',
      status: 403,
    });
  });

  it('ignores a code outside the catalog', () => {
    expect(toApiFailure(input(400, { code: 'ALGO_NUEVO' }))).toEqual({
      error: 'invalid-input',
      status: 400,
    });
  });

  it.each([400, 413, 422])('maps %i without a code to invalid-input', (s) => {
    expect(toApiFailure(input(s, null)).error).toBe('invalid-input');
  });

  it.each([null, undefined, '', 42, ['x'], { code: 7 }, { code: null }])(
    'never throws for the body %p',
    (body) => {
      const result = toApiFailure(input(500, body));
      expect(result).toEqual({ error: 'server', status: 500 });
    },
  );

  it('keeps the verify context: rejected tokens are one kind', () => {
    expect(toApiFailure(input(400, null), 'verify').error).toBe(
      'invalid-token' satisfies ApiErrorKind,
    );
    expect(toApiFailure(input(410, null), 'verify').error).toBe(
      'invalid-token',
    );
  });

  it('exposes Retry-After seconds only for a 429', () => {
    expect(toApiFailure(input(429, { code: 'RATE_LIMITED' }, '120'))).toEqual({
      error: 'rate-limited',
      status: 429,
      reason: 'RATE_LIMITED',
      retryAfterSeconds: 120,
    });
    expect(toApiFailure(input(429, null, 'abc'))).toEqual({
      error: 'rate-limited',
      status: 429,
    });
    expect(toApiFailure(input(503, null, '120'))).toEqual({
      error: 'server',
      status: 503,
    });
  });
});
