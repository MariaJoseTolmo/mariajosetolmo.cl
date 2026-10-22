import { isUncacheablePath } from './no-store';

describe('isUncacheablePath', () => {
  it.each([
    '/api/v1',
    '/api/v1/me',
    '/api/v1/admin/visits',
    '/api/auth',
    '/api/auth/refresh',
  ])('%s is uncacheable', (path) => {
    expect(isUncacheablePath(path)).toBe(true);
  });

  it.each([
    '/api/v1foo',
    '/api/v10/me',
    '/api/authors',
    '/api/auth-docs',
    '/api/health',
    '/api/.well-known/jwks.json',
    '/api',
    '/',
  ])('%s is not matched by prefix accident', (path) => {
    expect(isUncacheablePath(path)).toBe(false);
  });
});
