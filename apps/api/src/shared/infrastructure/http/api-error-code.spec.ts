import { API_ERROR_CODES, type ApiErrorCode } from './api-error-code';

describe('API_ERROR_CODES', () => {
  it('is exactly the ten public codes, in the contract order', () => {
    expect([...API_ERROR_CODES]).toEqual([
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
    ]);
  });

  it('has no duplicates', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });

  it('types a member as ApiErrorCode', () => {
    const code: ApiErrorCode = API_ERROR_CODES[0];
    expect(code).toBe('INVALID_INPUT');
  });
});
