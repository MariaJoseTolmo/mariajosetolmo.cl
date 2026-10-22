import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import request from 'supertest';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '../src/auth/application/ports/access-token.port';
import { createTestApp, TEST_KEY_ID, type TestApp } from './support/test-app';

describe('JWKS (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });
  afterEach(() => t.close());

  it('is public, cacheable and published under /api/.well-known', async () => {
    const res = await request(t.server())
      .get('/api/.well-known/jwks.json')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const body = res.body as JSONWebKeySet;
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]).toMatchObject({
      kty: 'RSA',
      kid: TEST_KEY_ID,
      alg: 'RS256',
      use: 'sig',
    });
  });

  it('exposes no private key material', async () => {
    const res = await request(t.server()).get('/api/.well-known/jwks.json');
    const [key] = (res.body as JSONWebKeySet).keys;
    for (const param of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      expect(key).not.toHaveProperty(param);
    }
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE');
  });

  it('verifies a token issued by the app using only the published keys', async () => {
    const issuer = t.app.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);
    const jwt = await issuer.issue(
      { sub: 'user-1', role: 'RECRUITER' },
      t.clock.now(),
    );
    const res = await request(t.server()).get('/api/.well-known/jwks.json');
    const jwks = createLocalJWKSet(res.body as JSONWebKeySet);
    const { payload, protectedHeader } = await jwtVerify(jwt, jwks, {
      currentDate: t.clock.now(),
    });
    expect(protectedHeader).toEqual({ alg: 'RS256', kid: TEST_KEY_ID });
    expect(payload.sub).toBe('user-1');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
  });
});
