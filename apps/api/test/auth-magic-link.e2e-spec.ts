import request from 'supertest';
import { sha256Hex } from '../src/shared/domain/hash';
import { InfrastructureUnavailable } from '../src/shared/domain/errors';
import { Email } from '../src/identity/domain/email';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

const VIEWER = 'cloudfront-viewer-address';
const ROUTE = '/api/auth/magic-link';

describe('POST /api/auth/magic-link', () => {
  let t: TestApp;

  afterEach(() => t.close());

  /** A request as CloudFront would deliver it: allowed Origin and a viewer address. */
  const post = (body: unknown, viewer = '203.0.113.10:50000'): request.Test =>
    request(t.server())
      .post(ROUTE)
      .set('Origin', TEST_ORIGIN)
      .set(VIEWER, viewer)
      .send(body as object);

  describe('with the CDN in front (CLIENT_IP_SOURCE=cloudfront)', () => {
    beforeEach(async () => {
      t = await createTestApp({ config: { clientIpSource: 'cloudfront' } });
    });

    describe('identical answer', () => {
      it('gives a registered and a new email the same bytes, and one message each', async () => {
        t.users.seed({
          id: 'u-1',
          email: Email.parse('known@example.test'),
          role: 'RECRUITER',
          company: null,
          name: null,
        });
        const known = await post({ email: 'known@example.test' }).expect(202);
        const fresh = await post({ email: 'new@example.test' }).expect(202);
        expect(known.text).toBe('{"status":"accepted"}');
        expect(fresh.text).toBe(known.text);
        expect(fresh.headers['content-type']).toBe(
          known.headers['content-type'],
        );
        expect(known.headers['set-cookie']).toBeUndefined();
        expect(fresh.headers['set-cookie']).toBeUndefined();
        expect(known.headers['cache-control']).toBe('no-store');
        expect(t.mail.sent.map((m) => m.to)).toEqual([
          'known@example.test',
          'new@example.test',
        ]);
      });
    });

    describe('no answer depends on whether the email exists', () => {
      const KNOWN = 'known@example.test';
      const FRESH = 'new@example.test';
      const seed = (): void =>
        t.users.seed({
          id: 'u-1',
          email: Email.parse(KNOWN),
          role: 'RECRUITER',
          company: null,
          name: null,
        });
      const reopen = async (
        options: Parameters<typeof createTestApp>[0] = {},
      ): Promise<void> => {
        await t.close();
        t = await createTestApp({
          ...options,
          config: { clientIpSource: 'cloudfront', ...options.config },
        });
        seed();
      };
      const shape = (res: request.Response): string =>
        JSON.stringify({ status: res.status, body: res.text });

      it('answers a registered, a new and an email-limited address with the same 202 and no code', async () => {
        await reopen({
          config: {
            rateLimits: {
              magicLinkIp: { limit: 50, windowSeconds: 900 },
              magicLinkEmail: { limit: 1, windowSeconds: 900 },
              verifyIp: { limit: 20, windowSeconds: 900 },
              refreshIp: { limit: 60, windowSeconds: 900 },
            },
          },
        });
        const known = await post({ email: KNOWN });
        const fresh = await post({ email: FRESH });
        const knownLimited = await post({ email: KNOWN });
        const freshLimited = await post({ email: FRESH });
        const all = [known, fresh, knownLimited, freshLimited];
        expect(all.map((r) => r.status)).toEqual([202, 202, 202, 202]);
        expect(new Set(all.map(shape)).size).toBe(1);
        for (const res of all) {
          expect(res.body).not.toHaveProperty('code');
        }
      });

      it.each([
        ['a foreign Origin', 403, 'ORIGIN_NOT_ALLOWED'],
        ['no viewer address', 403, 'CDN_REQUIRED'],
      ])(
        '%s fails the same way for both addresses',
        async (label, status, code) => {
          await reopen();
          const ask = (email: string): request.Test => {
            const req = request(t.server()).post(ROUTE);
            if (label === 'a foreign Origin') {
              req
                .set('Origin', 'https://evil.example.test')
                .set(VIEWER, '203.0.113.10:50000');
            } else {
              req.set('Origin', TEST_ORIGIN);
            }
            return req.send({ email });
          };
          const known = await ask(KNOWN);
          const fresh = await ask(FRESH);
          expect(known.status).toBe(status);
          expect(known.body).toMatchObject({ code });
          expect(shape(fresh)).toBe(shape(known));
        },
      );

      it('answers the same per-IP 429 for both addresses', async () => {
        await reopen({
          config: {
            rateLimits: {
              magicLinkIp: { limit: 1, windowSeconds: 900 },
              magicLinkEmail: { limit: 5, windowSeconds: 900 },
              verifyIp: { limit: 20, windowSeconds: 900 },
              refreshIp: { limit: 60, windowSeconds: 900 },
            },
          },
        });
        await post({ email: 'warmup@example.test' }).expect(202);
        const known = await post({ email: KNOWN });
        const fresh = await post({ email: FRESH });
        expect(known.status).toBe(429);
        expect(known.body).toMatchObject({ code: 'RATE_LIMITED' });
        expect(shape(fresh)).toBe(shape(known));
        expect(fresh.headers['retry-after']).toBe(known.headers['retry-after']);
      });

      it('answers the same 503 for both addresses when the store is down', async () => {
        await reopen({
          limiter: {
            hit: () => Promise.reject(new InfrastructureUnavailable()),
          },
        });
        const known = await post({ email: KNOWN });
        const fresh = await post({ email: FRESH });
        expect(known.status).toBe(503);
        expect(known.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
        expect(shape(fresh)).toBe(shape(known));
      });

      it('answers the same 400 for a malformed address, whatever else is registered', async () => {
        await reopen();
        const first = await post({ email: 'no-es-correo' });
        const second = await post({ email: 'tambien-no' });
        expect(first.status).toBe(400);
        expect(first.body).toMatchObject({ code: 'INVALID_INPUT' });
        expect(shape(second)).toBe(shape(first));
      });
    });

    describe('invalid input', () => {
      it.each([
        ['an address that is not one', { email: 'no-es-correo' }],
        ['no email', {}],
        [
          'a comma-separated second recipient',
          { email: 'x,victim@example.test' },
        ],
        [
          'a semicolon-separated second recipient',
          { email: 'x;victim@example.test' },
        ],
        ['an angle-bracket address', { email: 'x<victim@example.test>' }],
        ['an email that is not text', { email: ['a@example.test'] }],
        [
          'a company that is too long',
          { email: 'a@example.test', company: 'x'.repeat(121) },
        ],
      ])('%s: 400 JSON and nothing is sent', async (_label, body) => {
        const res = await post(body).expect(400);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toMatchObject({
          statusCode: 400,
          code: 'INVALID_INPUT',
        });
        expect(t.mail.sent).toHaveLength(0);
      });

      it('answers 400 to a body that is not JSON', async () => {
        await request(t.server())
          .post(ROUTE)
          .set('Origin', TEST_ORIGIN)
          .set(VIEWER, '203.0.113.10:50000')
          .set('Content-Type', 'application/json')
          .send('{"email":')
          .expect(400);
        expect(t.mail.sent).toHaveLength(0);
      });
    });

    it('does not create or change the user', async () => {
      t.users.seed({
        id: 'u-1',
        email: Email.parse('known@example.test'),
        role: 'RECRUITER',
        company: 'Acme',
        name: null,
      });
      await post({ email: 'known@example.test', company: 'Otra' }).expect(202);
      await post({ email: 'brand-new@example.test', company: 'Nueva' }).expect(
        202,
      );
      expect((await t.users.findById('u-1'))?.company).toBe('Acme');
      expect(t.users.all().map((u) => u.email.value)).toEqual([
        'known@example.test',
      ]);
    });

    it('keeps answering 202 when the email cannot be delivered, and logs it', async () => {
      t.mail.failWith = new Error('554 refused fresh@example.test');
      const res = await post({ email: 'fresh@example.test' }).expect(202);
      expect(res.text).toBe('{"status":"accepted"}');
      expect(t.logger.errors).toHaveLength(1);
      expect(t.logger.errors.join()).not.toContain('fresh@example.test');
    });

    it('stores only the hash and mails a link with the token in the fragment', async () => {
      await post({
        email: 'a@example.test',
        company: 'Acme',
        name: 'Ana',
      }).expect(202);
      const link = t.mail.sent[0]?.link ?? '';
      expect(link).toMatch(
        /^https:\/\/app\.example\.test\/acceso\/verificar\/#token=[A-Za-z0-9_-]{43}$/,
      );
      expect(link).not.toContain('?token=');
      const token = t.mail.lastToken();
      expect(t.store.entries()).toEqual([
        {
          key: sha256Hex(token),
          ttlSeconds: 900,
          payload: { email: 'a@example.test', company: 'Acme', name: 'Ana' },
        },
      ]);
      expect(JSON.stringify(t.store.entries())).not.toContain(token);
    });

    describe('client IP', () => {
      it.each([
        ['is missing', undefined],
        ['has no port', '203.0.113.10'],
        ['is not an address', 'banana:443'],
      ])(
        'answers 403 when CloudFront-Viewer-Address %s, and sends nothing',
        async (_l, header) => {
          const req = request(t.server())
            .post(ROUTE)
            .set('Origin', TEST_ORIGIN);
          if (header !== undefined) req.set(VIEWER, header);
          const res = await req.send({ email: 'a@example.test' }).expect(403);
          expect(res.body).toMatchObject({
            statusCode: 403,
            code: 'CDN_REQUIRED',
          });
          expect(t.mail.sent).toHaveLength(0);
        },
      );

      it('takes the address from the header, IPv6 included', async () => {
        await post({ email: 'a@example.test' }, '[2001:db8::7]:50000').expect(
          202,
        );
        expect(t.mail.sent).toHaveLength(1);
      });
    });

    describe('limits', () => {
      beforeEach(async () => {
        await t.close();
        t = await createTestApp({
          config: {
            clientIpSource: 'cloudfront',
            rateLimits: {
              magicLinkIp: { limit: 3, windowSeconds: 900 },
              magicLinkEmail: { limit: 2, windowSeconds: 900 },
              verifyIp: { limit: 20, windowSeconds: 900 },
              refreshIp: { limit: 60, windowSeconds: 900 },
            },
          },
        });
      });

      it('answers 429 with Retry-After once one IP has used its budget', async () => {
        for (const n of [1, 2, 3]) {
          await post({ email: `u${n}@example.test` }).expect(202);
        }
        t.clock.advanceSeconds(100);
        const res = await post({ email: 'u4@example.test' }).expect(429);
        expect(res.headers['retry-after']).toBe('800');
        expect(res.body).toMatchObject({
          statusCode: 429,
          code: 'RATE_LIMITED',
        });
        expect(t.mail.sent).toHaveLength(3);
      });

      it('lets another IP through while the first is limited', async () => {
        for (const n of [1, 2, 3]) {
          await post({ email: `u${n}@example.test` }).expect(202);
        }
        await post({ email: 'u4@example.test' }).expect(429);
        await post({ email: 'u5@example.test' }, '203.0.113.99:1').expect(202);
      });

      it('is not evaded by X-Forwarded-For', async () => {
        for (const n of [1, 2, 3]) {
          await post({ email: `u${n}@example.test` })
            .set('X-Forwarded-For', `198.51.100.${n}`)
            .expect(202);
        }
        await post({ email: 'u4@example.test' })
          .set('X-Forwarded-For', '198.51.100.200')
          .expect(429);
      });

      it('stays silent per email: same 202, no extra message', async () => {
        const answers: string[] = [];
        for (const n of [1, 2, 3]) {
          const res = await post(
            { email: 'same@example.test' },
            `203.0.113.${n}:5`,
          ).expect(202);
          answers.push(res.text);
        }
        expect(new Set(answers).size).toBe(1);
        expect(t.mail.sent).toHaveLength(2);
      });
    });
  });

  describe('Origin on the real route', () => {
    beforeEach(async () => {
      t = await createTestApp({ config: { clientIpSource: 'cloudfront' } });
    });

    it('answers 403 without an Origin header', async () => {
      const res = await request(t.server())
        .post(ROUTE)
        .set(VIEWER, '203.0.113.10:50000')
        .send({ email: 'a@example.test' })
        .expect(403);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(t.mail.sent).toHaveLength(0);
    });

    it('answers 403 for a foreign Origin', async () => {
      await request(t.server())
        .post(ROUTE)
        .set('Origin', 'https://evil.example.test')
        .set(VIEWER, '203.0.113.10:50000')
        .send({ email: 'a@example.test' })
        .expect(403);
      expect(t.mail.sent).toHaveLength(0);
    });

    it('accepts the allowed Origin', async () => {
      await post({ email: 'a@example.test' }).expect(202);
    });
  });

  describe('with the local socket resolver', () => {
    it('needs no CloudFront header', async () => {
      t = await createTestApp();
      await request(t.server())
        .post(ROUTE)
        .set('Origin', TEST_ORIGIN)
        .send({ email: 'a@example.test' })
        .expect(202);
      expect(t.mail.sent).toHaveLength(1);
    });
  });

  describe('when Redis is down (fail closed)', () => {
    const down = (): InfrastructureUnavailable =>
      new InfrastructureUnavailable(
        new Error('connect ECONNREFUSED 10.0.0.5:6379'),
      );

    it('answers 503 when the rate limiter fails', async () => {
      t = await createTestApp({
        config: { clientIpSource: 'cloudfront' },
        limiter: { hit: () => Promise.reject(down()) },
      });
      const res = await post({ email: 'a@example.test' }).expect(503);
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
      expect(t.mail.sent).toHaveLength(0);
    });

    it('answers 503 when the store fails', async () => {
      t = await createTestApp({
        config: { clientIpSource: 'cloudfront' },
        store: {
          save: () => Promise.reject(down()),
          consume: () => Promise.resolve(null),
        },
      });
      await post({ email: 'a@example.test' }).expect(503);
      expect(t.mail.sent).toHaveLength(0);
    });
  });
});
