import { createHttpGateway } from './http';
import { createMockGateway } from './mock';
import { MOCK_TOKEN } from './mock-token';
import {
  PLAYGROUND_ENDPOINTS,
  isPlaygroundEndpoint,
} from './playground-endpoints';
import type { PlaygroundEndpoint } from './types';

// Typed as `string`: the whole point is that callers outside the type system
// (or a bad cast) must still be rejected at runtime.
const OUTSIDE: string[] = [
  '/api/v1/admin/users',
  '/api/auth/logout',
  '/api/v1/me?x=1',
  '/API/v1/me',
  '/api/v1/me/',
  '/api/v1/../auth/logout',
  '//evil.example/api/v1/me',
  'https://evil.example/api/v1/me',
  '',
];

describe('playground endpoint allowlist', () => {
  it('lists exactly the five GET endpoints, in display order', () => {
    expect(PLAYGROUND_ENDPOINTS).toEqual([
      '/api/v1/profile',
      '/api/v1/experience?limit=2',
      '/api/v1/skills?level=advanced',
      '/api/v1/me',
      '/api/v1/admin/visits',
    ]);
  });

  it.each(PLAYGROUND_ENDPOINTS)('accepts %s', (endpoint) => {
    expect(isPlaygroundEndpoint(endpoint)).toBe(true);
  });

  it.each(OUTSIDE)('rejects %j', (endpoint) => {
    expect(isPlaygroundEndpoint(endpoint)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isPlaygroundEndpoint(undefined)).toBe(false);
    expect(isPlaygroundEndpoint(42)).toBe(false);
  });
});

describe('call() enforces the allowlist at runtime', () => {
  it.each(OUTSIDE)('http adapter never fetches %j', async (endpoint) => {
    const fetchImpl = jest.fn();
    const result = await createHttpGateway(fetchImpl).call(
      endpoint as PlaygroundEndpoint,
    );
    expect(result).toEqual({ ok: false, error: 'unexpected' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(OUTSIDE)('mock adapter rejects %j even with a session', async (e) => {
    window.sessionStorage.clear();
    const gateway = createMockGateway();
    await gateway.verifyToken(MOCK_TOKEN);
    expect(await gateway.call(e as PlaygroundEndpoint)).toEqual({
      ok: false,
      error: 'unexpected',
    });
  });
});
