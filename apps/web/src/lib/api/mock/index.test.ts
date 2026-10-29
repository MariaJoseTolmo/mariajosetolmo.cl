import { MOCK_TOKEN } from '../mock-token';
import { MOCK_MARKER, createMockGateway } from './index';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('mock gateway', () => {
  it('exports the unique leak marker', () => {
    expect(MOCK_MARKER).toBe('__WEB_CV_MOCK__');
  });

  it('accepts any magic-link request without revealing anything', async () => {
    const gateway = createMockGateway();
    const a = await gateway.requestMagicLink({ email: 'a@example.com' });
    const b = await gateway.requestMagicLink({
      email: 'otra@example.com',
      company: 'Empresa',
      name: 'Nombre',
    });
    expect(a).toEqual({ ok: true, data: undefined });
    expect(b).toEqual(a);
  });

  it('verifies only the mock token and keeps the session across instances', async () => {
    const gateway = createMockGateway();
    expect(await gateway.verifyToken('otro')).toEqual({
      ok: false,
      error: 'invalid-token',
    });
    expect(await gateway.getMe()).toEqual({ ok: false, error: 'unauthorized' });

    expect(await gateway.verifyToken(MOCK_TOKEN)).toEqual({
      ok: true,
      data: undefined,
    });
    const me = await createMockGateway().getMe();
    expect(me.ok).toBe(true);
  });

  it('returns a placeholder profile that carries the marker', async () => {
    const gateway = createMockGateway();
    await gateway.verifyToken(MOCK_TOKEN);
    const result = await gateway.getMe();
    if (!result.ok) throw new Error('expected a session');
    expect(result.data.role).toBe('RECRUITER');
    expect(JSON.stringify(result.data)).toContain(MOCK_MARKER);
    expect(result.data.availability).toEqual({
      modality: '[MODALIDAD]',
      start: '[INICIO]',
      salary: '[RENTA]',
    });
  });

  it('is deterministic: two calls return the same profile', async () => {
    const gateway = createMockGateway();
    await gateway.verifyToken(MOCK_TOKEN);
    expect(await gateway.getMe()).toEqual(await gateway.getMe());
  });

  it('logout ends the session', async () => {
    const gateway = createMockGateway();
    await gateway.verifyToken(MOCK_TOKEN);
    expect(await gateway.logout()).toEqual({ ok: true, data: undefined });
    expect(await gateway.getMe()).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('serves a placeholder CV link only with a session', async () => {
    const gateway = createMockGateway();
    expect(await gateway.getCvLink()).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    await gateway.verifyToken(MOCK_TOKEN);
    const link = await gateway.getCvLink();
    if (!link.ok) throw new Error('expected a link');
    expect(link.data.url).toContain('[cv-de-ejemplo]');
  });

  describe('call', () => {
    it('requires a session', async () => {
      expect(await createMockGateway().call('/api/v1/profile')).toEqual({
        ok: false,
        error: 'unauthorized',
      });
    });

    it('answers 200 with placeholder bodies for the public endpoints', async () => {
      const gateway = createMockGateway();
      await gateway.verifyToken(MOCK_TOKEN);
      for (const endpoint of [
        '/api/v1/profile',
        '/api/v1/experience?limit=2',
        '/api/v1/skills?level=advanced',
        '/api/v1/me',
      ] as const) {
        const result = await gateway.call(endpoint);
        if (!result.ok) throw new Error(`${endpoint} failed`);
        expect(result.data.status).toBe(200);
        expect(result.data.body).toBeTruthy();
      }
    });

    it('answers admin/visits with 403 as data (not as an error)', async () => {
      const gateway = createMockGateway();
      await gateway.verifyToken(MOCK_TOKEN);
      const result = await gateway.call('/api/v1/admin/visits');
      expect(result).toEqual({
        ok: true,
        data: {
          status: 403,
          statusText: 'Forbidden',
          body: {
            statusCode: 403,
            error: 'Forbidden',
            message: 'Forbidden resource',
            code: 'ROLE_NOT_ALLOWED',
          },
          failure: {
            error: 'forbidden',
            status: 403,
            reason: 'ROLE_NOT_ALLOWED',
          },
        },
      });
    });
  });
});

describe('one-shot error injection', () => {
  const KEY = 'web-cv-mock-error';
  const inject = (value: string) => window.sessionStorage.setItem(KEY, value);

  it.each([
    ['ORIGIN_NOT_ALLOWED', { error: 'forbidden', status: 403 }],
    [
      'RATE_LIMITED:120',
      { error: 'rate-limited', status: 429, retryAfterSeconds: 120 },
    ],
    ['RATE_LIMITED', { error: 'rate-limited', status: 429 }],
    ['SERVICE_UNAVAILABLE', { error: 'server', status: 503 }],
  ])('fails the next call as %s', async (value, expected) => {
    inject(value);
    const code = value.split(':')[0];
    expect(await createMockGateway().getMe()).toEqual({
      ok: false,
      reason: code,
      ...expected,
    });
  });

  it('applies to every gateway method', async () => {
    const gateway = createMockGateway();
    const calls = [
      () => gateway.requestMagicLink({ email: 'a@example.test' }),
      () => gateway.verifyToken(MOCK_TOKEN),
      () => gateway.getCvLink(),
      () => gateway.logout(),
    ];
    for (const run of calls) {
      inject('SERVICE_UNAVAILABLE');
      expect(await run()).toMatchObject({
        ok: false,
        reason: 'SERVICE_UNAVAILABLE',
      });
    }
  });

  it('answers a playground call like the http adapter: 4xx/5xx as data', async () => {
    inject('SERVICE_UNAVAILABLE');
    expect(await createMockGateway().call('/api/v1/profile')).toEqual({
      ok: true,
      data: {
        status: 503,
        statusText: 'Service Unavailable',
        body: {
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Mock error',
          code: 'SERVICE_UNAVAILABLE',
        },
        failure: {
          error: 'server',
          status: 503,
          reason: 'SERVICE_UNAVAILABLE',
        },
      },
    });
  });

  it('keeps Retry-After in the playground failure', async () => {
    inject('RATE_LIMITED:120');
    expect(await createMockGateway().call('/api/v1/me')).toMatchObject({
      ok: true,
      data: {
        status: 429,
        failure: { error: 'rate-limited', retryAfterSeconds: 120 },
      },
    });
  });

  it('answers a playground UNAUTHENTICATED as a failure, like http', async () => {
    inject('UNAUTHENTICATED');
    expect(await createMockGateway().call('/api/v1/me')).toEqual({
      ok: false,
      error: 'unauthorized',
      status: 401,
    });
  });

  it('is consumed by the first call: the second one is not injected', async () => {
    inject('SERVICE_UNAVAILABLE');
    const gateway = createMockGateway();
    expect(
      (await gateway.requestMagicLink({ email: 'a@example.test' })).ok,
    ).toBe(false);
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(await gateway.requestMagicLink({ email: 'a@example.test' })).toEqual(
      {
        ok: true,
        data: undefined,
      },
    );
  });

  it('does not depend on the email', async () => {
    const gateway = createMockGateway();
    inject('RATE_LIMITED:30');
    const a = await gateway.requestMagicLink({ email: 'a@example.test' });
    inject('RATE_LIMITED:30');
    const b = await gateway.requestMagicLink({ email: 'b@example.test' });
    expect(a).toEqual(b);
    expect(a.ok).toBe(false);
  });

  it.each(['', 'NOPE', 'RATE_LIMITED:abc', 'RATE_LIMITED:0', 'ALGO_NUEVO:5'])(
    'ignores the invalid value %j',
    async (value) => {
      inject(value);
      expect(
        await createMockGateway().requestMagicLink({ email: 'a@example.test' }),
      ).toEqual({ ok: true, data: undefined });
      expect(window.sessionStorage.getItem(KEY)).toBeNull();
    },
  );
});
