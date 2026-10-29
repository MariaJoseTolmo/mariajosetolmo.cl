import request from 'supertest';
import { InfrastructureUnavailable } from '../src/shared/domain/errors';
import { sha256Hex } from '../src/shared/domain/hash';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

const VIEWER = 'cloudfront-viewer-address';
const VIEWER_VALUE = '203.0.113.10:50000';

describe('POST /api/auth/verify', () => {
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
    body: unknown,
    viewer = VIEWER_VALUE,
  ): request.Test =>
    request(t.server())
      .post(path)
      .set('Origin', TEST_ORIGIN)
      .set(VIEWER, viewer)
      .send(body as object);

  /** Asks for a link (as a visitor) and returns the token the email carried. */
  const requestLink = async (
    email: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> => {
    await post('/api/auth/magic-link', { email, ...extra }).expect(202);
    return t.mail.lastToken();
  };
  const verify = (token: unknown, viewer?: string): request.Test =>
    post('/api/auth/verify', { token }, viewer);

  const cookiesOf = (res: request.Response): string[] => {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    return header ?? [];
  };
  const valueOf = (cookies: string[], name: string): string =>
    cookies
      .find((c) => c.startsWith(`${name}=`))
      ?.split(';')[0]
      ?.slice(name.length + 1) ?? '';
  /** The Cookie header a browser would send back after a successful verify. */
  const sessionCookie = (res: request.Response): string =>
    `__Host-access=${valueOf(cookiesOf(res), '__Host-access')}`;

  describe('happy path', () => {
    beforeEach(() => open());

    it('answers 204 with exactly the two session cookies', async () => {
      const token = await requestLink('recruiter@example.test');
      const res = await verify(token).expect(204);
      expect(res.text).toBe('');
      expect(res.headers['cache-control']).toBe('no-store');
      const cookies = cookiesOf(res);
      expect(cookies).toHaveLength(2);
      const access = valueOf(cookies, '__Host-access');
      const refresh = valueOf(cookies, '__Secure-refresh');
      expect(access.split('.')).toHaveLength(3);
      expect(refresh).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(cookies[0]).toBe(
        `__Host-access=${access}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict`,
      );
      expect(cookies[1]).toBe(
        `__Secure-refresh=${refresh}; Path=/api/auth; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`,
      );
      expect(cookies.join()).not.toMatch(/Domain=/i);
    });

    it('creates the user as RECRUITER, and the session works on /me', async () => {
      const token = await requestLink('recruiter@example.test');
      expect(t.users.all()).toHaveLength(0);
      const res = await verify(token).expect(204);
      expect(t.users.all().map((u) => [u.email.value, u.role])).toEqual([
        ['recruiter@example.test', 'RECRUITER'],
      ]);
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', sessionCookie(res))
        .expect(200);
      expect(me.body).toMatchObject({
        email: 'recruiter@example.test',
        role: 'RECRUITER',
        company: null,
        name: null,
      });
    });

    it('stores only the hash of the refresh token it set', async () => {
      const res = await verify(await requestLink('a@example.test')).expect(204);
      const refresh = valueOf(cookiesOf(res), '__Secure-refresh');
      expect(t.refresh.all().map((row) => row.tokenHash)).toEqual([
        sha256Hex(refresh),
      ]);
      expect(JSON.stringify(t.refresh.all())).not.toContain(refresh);
    });

    it('applies company and name only when the link is verified', async () => {
      const token = await requestLink('new@example.test', {
        company: 'Acme',
        name: 'Ana',
      });
      expect(t.users.all()).toHaveLength(0);
      const res = await verify(token).expect(204);
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', sessionCookie(res))
        .expect(200);
      expect(me.body).toMatchObject({ company: 'Acme', name: 'Ana' });
    });

    it('keeps the stored company when a later link brings none', async () => {
      await verify(
        await requestLink('a@example.test', { company: 'Acme' }),
      ).expect(204);
      const second = await verify(await requestLink('a@example.test')).expect(
        204,
      );
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', sessionCookie(second))
        .expect(200);
      expect(me.body).toMatchObject({ company: 'Acme' });
      expect(t.users.all()).toHaveLength(1);
    });
  });

  describe('roles', () => {
    beforeEach(() => open());

    it('makes the configured email ADMIN whatever its case, and lets it into /admin', async () => {
      const token = await requestLink('Admin@Example.test');
      const res = await verify(token).expect(204);
      const cookie = sessionCookie(res);
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', cookie)
        .expect(200);
      expect((me.body as { role: string }).role).toBe('ADMIN');
      await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', cookie)
        .expect(200);
    });

    it('trims and lowercases the configured ADMIN_EMAIL before comparing', async () => {
      await t.close();
      await open({ secrets: { adminEmail: '  ADMIN@Example.TEST  ' } });
      const res = await verify(await requestLink('admin@example.test')).expect(
        204,
      );
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', sessionCookie(res))
        .expect(200);
      expect((me.body as { role: string }).role).toBe('ADMIN');
    });

    it('keeps everyone else out of /admin', async () => {
      const res = await verify(
        await requestLink('recruiter@example.test'),
      ).expect(204);
      await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', sessionCookie(res))
        .expect(403);
    });

    it('ignores a role the visitor tries to send with the request', async () => {
      const token = await requestLink('recruiter@example.test', {
        role: 'ADMIN',
      });
      const res = await verify(token).expect(204);
      const cookie = sessionCookie(res);
      const me = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', cookie)
        .expect(200);
      expect((me.body as { role: string }).role).toBe('RECRUITER');
      await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', cookie)
        .expect(403);
    });
  });

  describe('a link that cannot be used (400, no cookies)', () => {
    beforeEach(() => open());

    const expectRefused = (res: request.Response): void => {
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toMatchObject({
        statusCode: 400,
        code: 'INVALID_TOKEN',
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    };

    it('reused', async () => {
      const token = await requestLink('a@example.test');
      await verify(token).expect(204);
      expectRefused(await verify(token));
      expect(t.refresh.all()).toHaveLength(1);
    });

    it('expired, but fine one second before', async () => {
      const early = await requestLink('a@example.test');
      t.clock.advanceSeconds(899);
      await verify(early).expect(204);
      const late = await requestLink('b@example.test');
      t.clock.advanceSeconds(900);
      expectRefused(await verify(late));
    });

    it('unknown, malformed or missing', async () => {
      expectRefused(await verify('N'.repeat(43)));
      expectRefused(await verify('basura'));
      expectRefused(await verify(undefined));
      expectRefused(await post('/api/auth/verify', {}));
    });

    it('gives the same status and code for unknown, expired, used and malformed', async () => {
      const used = await requestLink('used@example.test');
      await verify(used).expect(204);
      const expired = await requestLink('late@example.test');
      t.clock.advanceSeconds(900);
      const causes = {
        unknown: 'N'.repeat(43),
        expired,
        used,
        malformed: 'basura',
      };
      const answers = await Promise.all(
        Object.values(causes).map((token) => verify(token)),
      );
      const seen = new Set(
        answers.map((res) => {
          const body = res.body as { statusCode: number; code: string };
          return `${res.status}:${body.statusCode}:${body.code}`;
        }),
      );
      expect([...seen]).toEqual(['400:400:INVALID_TOKEN']);
      // Server-side states (unknown, expired, used) cannot be told apart at all.
      expect(new Set(answers.slice(0, 3).map((res) => res.text)).size).toBe(1);
    });

    it('never answers 403 or 404 for a bad token', async () => {
      const statuses = new Set<number>();
      for (const token of ['basura', 'N'.repeat(43), '']) {
        statuses.add((await verify(token)).status);
      }
      expect([...statuses]).toEqual([400]);
    });

    it('lets exactly one of two simultaneous requests through', async () => {
      const token = await requestLink('a@example.test');
      const [one, two] = await Promise.all([verify(token), verify(token)]);
      expect([one.status, two.status].sort()).toEqual([204, 400]);
      expect(t.refresh.all()).toHaveLength(1);
      expect(t.users.all()).toHaveLength(1);
    });
  });

  describe('per-IP limit', () => {
    it('answers 429 with Retry-After and sets no cookie', async () => {
      await open({
        config: {
          rateLimits: {
            magicLinkIp: { limit: 10, windowSeconds: 900 },
            magicLinkEmail: { limit: 3, windowSeconds: 900 },
            verifyIp: { limit: 2, windowSeconds: 600 },
            refreshIp: { limit: 60, windowSeconds: 900 },
          },
        },
      });
      await verify('N'.repeat(43)).expect(400);
      await verify('M'.repeat(43)).expect(400);
      t.clock.advanceSeconds(60);
      const res = await verify('L'.repeat(43)).expect(429);
      expect(res.headers['retry-after']).toBe('540');
      expect(res.headers['set-cookie']).toBeUndefined();
      await verify('L'.repeat(43), '203.0.113.99:1').expect(400);
    });
  });

  describe('a malformed token and the per-IP limit', () => {
    it('is refused before it spends the IP budget, and answers like any bad token', async () => {
      await open({
        config: {
          rateLimits: {
            magicLinkIp: { limit: 10, windowSeconds: 900 },
            magicLinkEmail: { limit: 3, windowSeconds: 900 },
            verifyIp: { limit: 1, windowSeconds: 600 },
            refreshIp: { limit: 60, windowSeconds: 900 },
          },
        },
      });
      for (const token of ['basura', 'basura', 'x', '']) {
        const res = await verify(token).expect(400);
        expect(res.body).toMatchObject({ code: 'INVALID_TOKEN' });
      }
      // The only budget unit is still there: a well-formed unknown token is
      // answered 400 (not 429), and only then is the budget spent.
      await verify('N'.repeat(43)).expect(400);
      await verify('M'.repeat(43)).expect(429);
    });
  });

  describe('Origin on the real route', () => {
    beforeEach(() => open());

    it('answers 403 without Origin, and for a foreign one', async () => {
      const token = await requestLink('a@example.test');
      await request(t.server())
        .post('/api/auth/verify')
        .set(VIEWER, VIEWER_VALUE)
        .send({ token })
        .expect(403);
      await request(t.server())
        .post('/api/auth/verify')
        .set('Origin', 'https://evil.example.test')
        .set(VIEWER, VIEWER_VALUE)
        .send({ token })
        .expect(403);
      // The refused requests did not burn the link.
      await verify(token).expect(204);
    });

    it('answers 403 when CloudFront-Viewer-Address is missing', async () => {
      const token = await requestLink('a@example.test');
      const res = await request(t.server())
        .post('/api/auth/verify')
        .set('Origin', TEST_ORIGIN)
        .send({ token })
        .expect(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('when a store is down (fail closed)', () => {
    const down = (): InfrastructureUnavailable =>
      new InfrastructureUnavailable(
        new Error('connect ECONNREFUSED 10.0.0.5:6379'),
      );

    it('answers 503 and sets no cookie when the link store fails', async () => {
      await open({
        store: {
          save: () => Promise.resolve(),
          consume: () => Promise.reject(down()),
        },
      });
      const res = await verify('N'.repeat(43)).expect(503);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(t.users.all()).toHaveLength(0);
    });

    it('answers 503 when the rate limiter fails', async () => {
      await open({ limiter: { hit: () => Promise.reject(down()) } });
      const res = await verify('N'.repeat(43)).expect(503);
      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('plain-HTTP local development (COOKIE_SECURE=false)', () => {
    it('uses the unprefixed names and drops Secure', async () => {
      await open({ config: { cookieSecure: false } });
      const res = await verify(await requestLink('a@example.test')).expect(204);
      const cookies = cookiesOf(res);
      expect(cookies[0]).toMatch(
        /^access=[^;]+; Path=\/; Max-Age=900; HttpOnly; SameSite=Strict$/,
      );
      expect(cookies[1]).toMatch(
        /^refresh=[^;]+; Path=\/api\/auth; Max-Age=604800; HttpOnly; SameSite=Strict$/,
      );
    });
  });
});
