import { createHmac } from 'node:crypto';
import request from 'supertest';
import { testKeyPair } from './support/keys';
import { createTestApp, type TestApp } from './support/test-app';

const b64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('GET /api/v1/me (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  const getMe = (cookie?: string): request.Test => {
    const req = request(t.server()).get('/api/v1/me');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('returns exactly the contract keys, uncached', async () => {
    const cookie = await t.login({ company: 'Acme', name: 'Ana' });
    t.availability.set({
      modality: 'example modality',
      start: 'example start',
      salary: 'example salary',
    });
    const res = await getMe(cookie).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      email: 'recruiter@example.test',
      role: 'RECRUITER',
      company: 'Acme',
      name: 'Ana',
      availability: {
        modality: 'example modality',
        start: 'example start',
        salary: 'example salary',
      },
    });
    expect(Object.keys(res.body as object).sort()).toEqual([
      'availability',
      'company',
      'email',
      'name',
      'role',
    ]);
  });

  it('serialises missing company and name as null, not absent', async () => {
    const cookie = await t.login({ company: null, name: null });
    const res = await getMe(cookie).expect(200);
    const body = res.body as Record<string, unknown>;
    expect(body).toHaveProperty('company', null);
    expect(body).toHaveProperty('name', null);
  });

  it('reflects the ADMIN role', async () => {
    const cookie = await t.login({
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'ADMIN',
    });
    const res = await getMe(cookie).expect(200);
    expect((res.body as { role: string }).role).toBe('ADMIN');
  });

  it('answers 401 JSON without a session', async () => {
    const res = await getMe().expect(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('answers 401 when the user no longer exists', async () => {
    const cookie = await t.login();
    t.users.remove('user-1');
    const res = await getMe(cookie).expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  describe('rejects bad access tokens', () => {
    const claims = (): object => {
      const iat = Math.floor(t.clock.now().getTime() / 1000);
      return {
        sub: 'user-1',
        role: 'ADMIN',
        iss: 'https://issuer.example.test',
        aud: 'web_cv-api',
        iat,
        exp: iat + 900,
      };
    };

    it('alg none', async () => {
      await t.login();
      const jwt = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims())}.`;
      await getMe(`__Host-access=${jwt}`).expect(401);
    });

    it('HS256 signed with the public key as secret', async () => {
      await t.login();
      const input = `${b64url({ alg: 'HS256', typ: 'JWT', kid: 'test-kid-1' })}.${b64url(claims())}`;
      const signature = createHmac('sha256', testKeyPair().publicPem)
        .update(input)
        .digest('base64url');
      await getMe(`__Host-access=${input}.${signature}`).expect(401);
    });

    it('expired', async () => {
      const cookie = await t.login();
      t.clock.advanceSeconds(900 + 6);
      await getMe(cookie).expect(401);
    });

    it('still valid just before expiry', async () => {
      const cookie = await t.login();
      t.clock.advanceSeconds(899);
      await getMe(cookie).expect(200);
    });

    it('tampered signature', async () => {
      const cookie = await t.login();
      const tampered = `${cookie.slice(0, -2)}${cookie.endsWith('AA') ? 'BB' : 'AA'}`;
      await getMe(tampered).expect(401);
    });
  });

  it('does not require an Origin header on GET', async () => {
    const cookie = await t.login();
    await getMe(cookie).expect(200);
  });
});
