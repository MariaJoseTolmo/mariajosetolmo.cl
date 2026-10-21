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
          body: { statusCode: 403, message: 'Forbidden' },
        },
      });
    });
  });
});
