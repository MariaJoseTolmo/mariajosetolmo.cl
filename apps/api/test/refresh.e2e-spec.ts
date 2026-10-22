import request from 'supertest';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/application/ports/refresh-token-repository.port';
import { InfrastructureUnavailable } from '../src/shared/domain/errors';
import { sha256Hex } from '../src/shared/domain/hash';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

const VIEWER = 'cloudfront-viewer-address';
const VIEWER_VALUE = '203.0.113.10:50000';
const DAY = 24 * 3600;

const CLEARED = [
  '__Host-access=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
  '__Secure-refresh=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
];

describe('POST /api/auth/refresh and /api/auth/logout', () => {
  let t: TestApp;

  const open = async (
    options: Parameters<typeof createTestApp>[0] = {},
  ): Promise<void> => {
    t = await createTestApp({
      ...options,
      config: { clientIpSource: 'cloudfront', ...options.config },
    });
  };
  afterEach(() => t.close());

  const post = (
    path: string,
    cookie?: string,
    viewer = VIEWER_VALUE,
  ): request.Test => {
    const req = request(t.server())
      .post(path)
      .set('Origin', TEST_ORIGIN)
      .set(VIEWER, viewer);
    return cookie === undefined ? req : req.set('Cookie', cookie);
  };
  const refresh = (token?: string, viewer?: string): request.Test =>
    post(
      '/api/auth/refresh',
      token === undefined ? undefined : `__Secure-refresh=${token}`,
      viewer,
    );
  const logout = (token?: string): request.Test =>
    post(
      '/api/auth/logout',
      token === undefined ? undefined : `__Secure-refresh=${token}`,
    );

  const cookiesOf = (res: request.Response): string[] =>
    (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const valueOf = (cookies: string[], name: string): string =>
    cookies
      .find((c) => c.startsWith(`${name}=`))
      ?.split(';')[0]
      ?.slice(name.length + 1) ?? '';

  /** A full login through the real routes; returns the cookies a browser keeps. */
  const signIn = async (
    email = 'recruiter@example.test',
    viewer = VIEWER_VALUE,
  ): Promise<{ access: string; refresh: string }> => {
    await post('/api/auth/magic-link', undefined, viewer)
      .send({ email })
      .expect(202);
    const res = await post('/api/auth/verify', undefined, viewer)
      .send({ token: t.mail.lastToken() })
      .expect(204);
    const cookies = cookiesOf(res);
    return {
      access: valueOf(cookies, '__Host-access'),
      refresh: valueOf(cookies, '__Secure-refresh'),
    };
  };
  const me = (access: string): request.Test =>
    request(t.server())
      .get('/api/v1/me')
      .set('Cookie', `__Host-access=${access}`);

  describe('refresh: rotation', () => {
    beforeEach(() => open());

    it('answers 204 with a new pair of cookies and spends the old token', async () => {
      const session = await signIn();
      t.clock.advanceSeconds(DAY);
      const res = await refresh(session.refresh).expect(204);

      expect(res.text).toBe('');
      expect(res.headers['cache-control']).toBe('no-store');
      const cookies = cookiesOf(res);
      expect(cookies).toHaveLength(2);
      const access = valueOf(cookies, '__Host-access');
      const next = valueOf(cookies, '__Secure-refresh');
      expect(access.split('.')).toHaveLength(3);
      expect(access).not.toBe(session.access);
      expect(next).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(next).not.toBe(session.refresh);
      expect(cookies[0]).toBe(
        `__Host-access=${access}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict`,
      );
      // Absolute session: 7 days minus the day that has passed.
      expect(cookies[1]).toBe(
        `__Secure-refresh=${next}; Path=/api/auth; Max-Age=${6 * DAY}; HttpOnly; Secure; SameSite=Strict`,
      );
      expect(cookies.join()).not.toMatch(/Domain=/i);
      expect(
        await t.refresh.findByHash(sha256Hex(session.refresh)),
      ).toMatchObject({ usedAt: t.clock.now() });
    });

    it('the new access cookie opens /me', async () => {
      const session = await signIn('ana@example.test');
      const res = await refresh(session.refresh).expect(204);
      const body = (
        await me(valueOf(cookiesOf(res), '__Host-access')).expect(200)
      ).body as { email: string };
      expect(body.email).toBe('ana@example.test');
    });

    it('stores only the hash of the new refresh token', async () => {
      const session = await signIn();
      const res = await refresh(session.refresh).expect(204);
      const next = valueOf(cookiesOf(res), '__Secure-refresh');
      expect(t.refresh.all().map((row) => row.tokenHash)).toEqual([
        sha256Hex(session.refresh),
        sha256Hex(next),
      ]);
      expect(JSON.stringify(t.refresh.all())).not.toContain(next);
    });

    it('keeps the family end date through a chain of rotations', async () => {
      let token = (await signIn()).refresh;
      for (const remaining of [6, 5, 4]) {
        t.clock.advanceSeconds(DAY);
        const res = await refresh(token).expect(204);
        expect(cookiesOf(res)[1]).toContain(`Max-Age=${remaining * DAY}`);
        token = valueOf(cookiesOf(res), '__Secure-refresh');
      }
    });

    it('uses the insecure cookie names when COOKIE_SECURE=false', async () => {
      await t.close();
      await open({ config: { cookieSecure: false } });
      await post('/api/auth/magic-link').send({ email: 'a@example.test' });
      const verified = await post('/api/auth/verify')
        .send({ token: t.mail.lastToken() })
        .expect(204);
      const token = valueOf(cookiesOf(verified), 'refresh');
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const res = await post('/api/auth/refresh', `refresh=${token}`).expect(
        204,
      );
      expect(cookiesOf(res)[1]).toMatch(
        /^refresh=[\w-]{43}; Path=\/api\/auth; Max-Age=\d+; HttpOnly; SameSite=Strict$/,
      );
    });
  });

  describe('refresh: no session', () => {
    beforeEach(() => open());

    it('without a cookie: 401 JSON and both cookies cleared', async () => {
      const res = await refresh().expect(401);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(cookiesOf(res)).toEqual(CLEARED);
    });

    it.each([
      ['garbage', 'not-a-token'],
      ['a well formed token nobody issued', 'Z'.repeat(43)],
    ])('%s: 401 and cookies cleared', async (_label, value) => {
      const res = await refresh(value).expect(401);
      expect(cookiesOf(res)).toEqual(CLEARED);
    });

    it('past the 7 days of the family: 401 and cookies cleared', async () => {
      const session = await signIn();
      t.clock.advanceSeconds(7 * DAY);
      const res = await refresh(session.refresh).expect(401);
      expect(cookiesOf(res)).toEqual(CLEARED);
    });

    it('one second before the 7 days it still refreshes', async () => {
      const session = await signIn();
      t.clock.advanceSeconds(7 * DAY - 1);
      const res = await refresh(session.refresh).expect(204);
      expect(cookiesOf(res)[1]).toContain('Max-Age=1;');
    });
  });

  describe('refresh: reuse detection', () => {
    beforeEach(() => open());

    it('reuse after 10 s revokes the family: R1 and the newest R2 both fail, cookies cleared', async () => {
      const session = await signIn();
      const r2 = valueOf(
        cookiesOf(await refresh(session.refresh).expect(204)),
        '__Secure-refresh',
      );
      t.clock.advanceSeconds(11);

      const reuse = await refresh(session.refresh).expect(401);
      expect(cookiesOf(reuse)).toEqual(CLEARED);
      const after = await refresh(r2).expect(401);
      expect(cookiesOf(after)).toEqual(CLEARED);
    });

    it('reuse within 10 s: 401 without Set-Cookie, family intact, R2 still refreshes', async () => {
      const session = await signIn();
      const r2 = valueOf(
        cookiesOf(await refresh(session.refresh).expect(204)),
        '__Secure-refresh',
      );
      t.clock.advanceSeconds(10);

      const race = await refresh(session.refresh).expect(401);
      expect(race.headers['set-cookie']).toBeUndefined();
      await refresh(r2).expect(204);
    });

    it('does not touch another session of the same user', async () => {
      const a = await signIn('same@example.test');
      const b = await signIn('same@example.test');
      expect(a.refresh).not.toBe(b.refresh);
      await refresh(a.refresh).expect(204);
      t.clock.advanceSeconds(60);
      await refresh(a.refresh).expect(401);
      await refresh(b.refresh).expect(204);
    });

    it('two simultaneous requests with one token: one 204, one 401 that leaves the cookies alone', async () => {
      const session = await signIn();
      const [first, second] = await Promise.all([
        refresh(session.refresh),
        refresh(session.refresh),
      ]);
      expect([first.status, second.status].sort()).toEqual([204, 401]);
      const loser = first.status === 401 ? first : second;
      expect(loser.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('refresh: limits, Origin and infrastructure', () => {
    it('answers 429 with Retry-After and no cookie once the IP is over its limit', async () => {
      await open({
        config: {
          rateLimits: {
            magicLinkIp: { limit: 10, windowSeconds: 900 },
            magicLinkEmail: { limit: 3, windowSeconds: 900 },
            verifyIp: { limit: 20, windowSeconds: 900 },
            refreshIp: { limit: 2, windowSeconds: 600 },
          },
        },
      });
      const session = await signIn();
      await refresh('Y'.repeat(43)).expect(401);
      await refresh('X'.repeat(43)).expect(401);
      t.clock.advanceSeconds(60);
      const res = await refresh(session.refresh).expect(429);
      expect(res.headers['retry-after']).toBe('540');
      expect(res.headers['set-cookie']).toBeUndefined();
      // The refused call did not spend the token, and another IP passes.
      await refresh(session.refresh, '203.0.113.99:1').expect(204);
    });

    it('POST without Origin or with a foreign Origin: 403 and the token is not spent', async () => {
      await open();
      const session = await signIn();
      await request(t.server())
        .post('/api/auth/refresh')
        .set(VIEWER, VIEWER_VALUE)
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(403);
      await request(t.server())
        .post('/api/auth/refresh')
        .set('Origin', 'https://evil.example.test')
        .set(VIEWER, VIEWER_VALUE)
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(403);
      expect(
        await t.refresh.findByHash(sha256Hex(session.refresh)),
      ).toMatchObject({ usedAt: null, revokedAt: null });
    });

    it('GET /api/auth/refresh does not exist', async () => {
      await open();
      await request(t.server()).get('/api/auth/refresh').expect(404);
    });

    it('missing viewer address behind CloudFront: 403, the token is not spent', async () => {
      await open();
      const session = await signIn();
      await request(t.server())
        .post('/api/auth/refresh')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(403);
      await refresh(session.refresh).expect(204);
    });

    it('Redis down: 503 with a generic body, no cookies touched', async () => {
      const failing = {
        hit: () => Promise.reject(new InfrastructureUnavailable()),
      };
      await open({ limiter: failing });
      const res = await refresh('Q'.repeat(43)).expect(503);
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('Postgres down: 503 with a generic body and cookies left alone (not a logout)', async () => {
      await open({
        customize: (builder) =>
          builder.overrideProvider(REFRESH_TOKEN_REPOSITORY).useValue({
            findByHash: () =>
              Promise.reject(
                new InfrastructureUnavailable(
                  new Error('ECONNREFUSED 10.0.0.9'),
                ),
              ),
          }),
      });
      const res = await refresh('Q'.repeat(43)).expect(503);
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.9');
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('logout', () => {
    beforeEach(() => open());

    it('with a session: 204, both cookies cleared, and the refresh token is dead', async () => {
      const session = await signIn();
      const res = await logout(session.refresh).expect(204);
      expect(res.text).toBe('');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(cookiesOf(res)).toEqual(CLEARED);
      await refresh(session.refresh).expect(401);
    });

    it('kills the whole family, including a token already rotated away', async () => {
      const session = await signIn();
      const r2 = valueOf(
        cookiesOf(await refresh(session.refresh).expect(204)),
        '__Secure-refresh',
      );
      await logout(r2).expect(204);
      await refresh(r2).expect(401);
    });

    it('does not end other sessions of the user', async () => {
      const a = await signIn('same@example.test');
      const b = await signIn('same@example.test');
      await logout(a.refresh).expect(204);
      await refresh(b.refresh).expect(204);
    });

    it('the access JWT already issued keeps working until it expires', async () => {
      const session = await signIn();
      await logout(session.refresh).expect(204);
      await me(session.access).expect(200);
      t.clock.advanceSeconds(910); // 900 s + the 5 s clock tolerance
      await me(session.access).expect(401);
    });

    it.each([
      ['no cookies at all', undefined],
      ['an unknown refresh token', 'Z'.repeat(43)],
      ['garbage in the cookie', 'junk'],
    ])('%s: still 204 with both cookies cleared', async (_label, value) => {
      const res = await logout(value).expect(204);
      expect(cookiesOf(res)).toEqual(CLEARED);
    });

    it('answers 204 twice in a row', async () => {
      const session = await signIn();
      await logout(session.refresh).expect(204);
      await logout(session.refresh).expect(204);
    });

    it('does not need the viewer address (it keeps no counter)', async () => {
      const session = await signIn();
      await request(t.server())
        .post('/api/auth/logout')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(204);
      await refresh(session.refresh).expect(401);
    });

    it('POST without Origin or with a foreign Origin: 403, the session survives', async () => {
      const session = await signIn();
      await request(t.server())
        .post('/api/auth/logout')
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(403);
      await request(t.server())
        .post('/api/auth/logout')
        .set('Origin', 'https://evil.example.test')
        .set('Cookie', `__Secure-refresh=${session.refresh}`)
        .expect(403);
      await refresh(session.refresh).expect(204);
    });
  });

  describe('logout with the database down', () => {
    it('still answers 204, clears the cookies and logs the failure kind', async () => {
      await open({
        customize: (builder) =>
          builder.overrideProvider(REFRESH_TOKEN_REPOSITORY).useValue({
            revokeFamilyOf: () =>
              Promise.reject(
                new InfrastructureUnavailable(
                  new Error('ECONNREFUSED 10.0.0.9'),
                ),
              ),
          }),
      });
      const res = await logout('A'.repeat(43)).expect(204);
      expect(cookiesOf(res)).toEqual(CLEARED);
      expect(t.logger.warnings).toEqual([
        'Logout could not revoke the session: InfrastructureUnavailable INFRASTRUCTURE_UNAVAILABLE',
      ]);
    });
  });

  describe('documentation', () => {
    it('lists both routes under auth in the OpenAPI document', async () => {
      await open();
      const doc = (await request(t.server()).get('/api/docs-json').expect(200))
        .body as { paths: Record<string, Record<string, { tags?: string[] }>> };
      expect(doc.paths['/api/auth/refresh']?.['post']?.tags).toEqual(['auth']);
      expect(doc.paths['/api/auth/logout']?.['post']?.tags).toEqual(['auth']);
    });
  });
});
