import { errorFromStatus, failure } from './errors';

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
