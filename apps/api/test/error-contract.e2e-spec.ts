import request from 'supertest';
import type { ArgumentsHost } from '@nestjs/common';
import {
  InfrastructureUnavailable,
  InvalidInput,
} from '../src/shared/domain/errors';
import { ApiExceptionFilter } from '../src/shared/infrastructure/http/api-exception.filter';
import { API_ERROR_CODES } from '../src/shared/infrastructure/http/api-error-code';
import { assertCatalogCode } from './support/error-contract';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

const ROUTE = '/api/auth/magic-link';
const BODY_KEYS = ['code', 'error', 'message', 'statusCode'];

describe('API error contract', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(() => t.close());

  const postRaw = (raw: string): request.Test =>
    request(t.server())
      .post(ROUTE)
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(raw);

  describe('errors raised by the body parser', () => {
    it('answers malformed JSON with 400 INVALID_INPUT and no echo of the body', async () => {
      const res = await postRaw('{"email":').expect(400);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Object.keys(res.body as object).sort()).toEqual(BODY_KEYS);
      expect(res.body).toMatchObject({
        statusCode: 400,
        code: 'INVALID_INPUT',
      });
      expect((res.body as { message: string }).message).not.toContain('email');
    });

    it('answers a body over the limit with 413 INVALID_INPUT', async () => {
      const res = await postRaw(
        JSON.stringify({ email: 'a'.repeat(300_000) }),
      ).expect(413);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Object.keys(res.body as object).sort()).toEqual(BODY_KEYS);
      expect(res.body).toMatchObject({
        statusCode: 413,
        code: 'INVALID_INPUT',
      });
    });
  });

  describe('routes that do not exist', () => {
    it('answers 404 NOT_FOUND with a fixed message that omits the route', async () => {
      const res = await request(t.server())
        .get('/api/v1/no-such-secret-route')
        .expect(404);
      expect(Object.keys(res.body as object).sort()).toEqual(BODY_KEYS);
      expect(res.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Not found',
        code: 'NOT_FOUND',
      });
    });
  });

  describe('every error answers with the four keys and a catalog code', () => {
    const VIEWER = 'cloudfront-viewer-address';
    const VIEWER_VALUE = '203.0.113.10:50000';
    const SECRET_MARKERS = ['limit=0', 'no-such-secret', 'evil.example.test'];

    const expectContract = (
      res: request.Response,
      status: number,
      code: string,
    ): void => {
      expect(res.status).toBe(status);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = res.body as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(BODY_KEYS);
      expect(body['statusCode']).toBe(status);
      expect(body['code']).toBe(code);
      assertCatalogCode(body['code']);
      expect(typeof body['message']).toBe('string');
      for (const marker of SECRET_MARKERS) {
        expect(JSON.stringify(body)).not.toContain(marker);
      }
    };

    const withCdn = async (
      options: Parameters<typeof createTestApp>[0] = {},
    ): Promise<void> => {
      await t.close();
      t = await createTestApp({
        ...options,
        config: { clientIpSource: 'cloudfront', ...options.config },
      });
    };

    it('400 INVALID_INPUT: limit=0', async () => {
      const cookie = await t.login();
      const res = await request(t.server())
        .get('/api/v1/experience?limit=0')
        .set('Cookie', cookie);
      expectContract(res, 400, 'INVALID_INPUT');
    });

    it('401 UNAUTHENTICATED: no cookies', async () => {
      const res = await request(t.server()).get('/api/v1/me');
      expectContract(res, 401, 'UNAUTHENTICATED');
    });

    it('403 CDN_REQUIRED: no viewer address behind the CDN', async () => {
      await withCdn();
      const res = await request(t.server())
        .post(ROUTE)
        .set('Origin', TEST_ORIGIN)
        .send({ email: 'a@example.test' });
      expectContract(res, 403, 'CDN_REQUIRED');
    });

    it('403 ORIGIN_NOT_ALLOWED: a foreign Origin', async () => {
      await withCdn();
      const res = await request(t.server())
        .post(ROUTE)
        .set('Origin', 'https://evil.example.test')
        .set(VIEWER, VIEWER_VALUE)
        .send({ email: 'a@example.test' });
      expectContract(res, 403, 'ORIGIN_NOT_ALLOWED');
    });

    it('403 ROLE_NOT_ALLOWED: a RECRUITER on the admin route', async () => {
      const cookie = await t.login({ role: 'RECRUITER' });
      const res = await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', cookie);
      expectContract(res, 403, 'ROLE_NOT_ALLOWED');
    });

    it('404 NOT_FOUND: a route that does not exist', async () => {
      const res = await request(t.server()).get('/api/v1/no-such-secret');
      expectContract(res, 404, 'NOT_FOUND');
    });

    it('429 RATE_LIMITED: per-IP budget used up, with an integer Retry-After', async () => {
      await withCdn({
        config: {
          rateLimits: {
            magicLinkIp: { limit: 3, windowSeconds: 900 },
            magicLinkEmail: { limit: 2, windowSeconds: 900 },
            verifyIp: { limit: 20, windowSeconds: 900 },
            refreshIp: { limit: 60, windowSeconds: 900 },
          },
        },
      });
      const ask = (n: number): request.Test =>
        request(t.server())
          .post(ROUTE)
          .set('Origin', TEST_ORIGIN)
          .set(VIEWER, VIEWER_VALUE)
          .send({ email: `u${n}@example.test` });
      for (const n of [1, 2, 3]) await ask(n).expect(202);
      const res = await ask(4);
      expectContract(res, 429, 'RATE_LIMITED');
      expect(res.headers['retry-after']).toMatch(/^\d+$/);
    });

    it('503 SERVICE_UNAVAILABLE: the rate limiter store is down', async () => {
      await withCdn({
        limiter: { hit: () => Promise.reject(new InfrastructureUnavailable()) },
      });
      const res = await request(t.server())
        .post(ROUTE)
        .set('Origin', TEST_ORIGIN)
        .set(VIEWER, VIEWER_VALUE)
        .send({ email: 'a@example.test' });
      expectContract(res, 503, 'SERVICE_UNAVAILABLE');
    });
  });

  describe('the validator itself', () => {
    it('fails on a code that is not in the catalog', () => {
      expect(() => assertCatalogCode('ALGO_NUEVO')).toThrow(
        /not in the catalog/,
      );
      expect(() => assertCatalogCode(undefined)).toThrow(/not in the catalog/);
    });

    it('accepts every catalog code', () => {
      for (const code of API_ERROR_CODES) {
        expect(() => assertCatalogCode(code)).not.toThrow();
      }
    });
  });

  describe('message is not the contract', () => {
    it('keeps the code when only the message of the error changes', () => {
      const codeFor = (message: string): unknown => {
        let body: Record<string, unknown> = {};
        const res = {
          status: () => res,
          setHeader: () => res,
          json: (b: Record<string, unknown>) => {
            body = b;
            return res;
          },
        };
        new ApiExceptionFilter({ error: () => undefined }).catch(
          new InvalidInput(message),
          { switchToHttp: () => ({ getResponse: () => res }) } as ArgumentsHost,
        );
        return body['code'];
      };
      expect(codeFor('first wording')).toBe('INVALID_INPUT');
      expect(codeFor('a completely different wording')).toBe('INVALID_INPUT');
    });

    it('answers an unexpected exception with a fixed 500 INTERNAL_ERROR', async () => {
      await t.close();
      t = await createTestApp({
        limiter: {
          hit: () => Promise.reject(new Error('connect ECONNREFUSED 10.9.9.9')),
        },
        config: { clientIpSource: 'cloudfront' },
      });
      const res = await request(t.server())
        .post(ROUTE)
        .set('Origin', TEST_ORIGIN)
        .set('cloudfront-viewer-address', '203.0.113.10:50000')
        .send({ email: 'a@example.test' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    });
  });
});
