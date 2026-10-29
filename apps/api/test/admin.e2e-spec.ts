import { Controller, Post } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app';

interface OpenApiDocument {
  paths: Record<string, unknown>;
}

const JSON_TYPE = /application\/json/;

// Only a probe is needed for the 401 case: a good Origin and no session on a
// POST route that no real controller exposes to the guards under test.
@Controller('v1/probe')
class ProbeController {
  @Post()
  probe(): { ok: boolean } {
    return { ok: true };
  }
}

describe('admin and error surface (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp({ controllers: [ProbeController] });
  });
  afterEach(() => t.close());

  describe('GET /api/v1/admin/visits', () => {
    it('answers 403 JSON for a RECRUITER', async () => {
      const cookie = await t.login({ role: 'RECRUITER' });
      const res = await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', cookie)
        .expect(403);
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
      expect(res.body).toMatchObject({
        statusCode: 403,
        code: 'ROLE_NOT_ALLOWED',
      });
    });

    it('answers 200 with an empty list for an ADMIN', async () => {
      const cookie = await t.login({
        id: 'admin-1',
        email: 'admin@example.test',
        role: 'ADMIN',
      });
      const res = await request(t.server())
        .get('/api/v1/admin/visits')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
      expect(res.body).toEqual([]);
    });

    it('answers 401 without a session', async () => {
      const res = await request(t.server())
        .get('/api/v1/admin/visits')
        .expect(401);
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
    });
  });

  describe('Swagger', () => {
    it('does not document any /api/v1/admin path', async () => {
      const res = await request(t.server()).get('/api/docs-json').expect(200);
      const { paths } = res.body as OpenApiDocument;
      expect(Object.keys(paths).length).toBeGreaterThan(0);
      expect(
        Object.keys(paths).filter((p) => p.startsWith('/api/v1/admin')),
      ).toEqual([]);
      expect(paths).toHaveProperty(['/api/v1/me']);
    });

    it('contains no cookie values, tokens or key material', async () => {
      const res = await request(t.server()).get('/api/docs-json').expect(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/__Host-access=|__Secure-refresh=/);
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
      expect(text).not.toMatch(/BEGIN [A-Z ]*KEY/);
    });
  });

  describe('error bodies do not leak internals', () => {
    it('401, 403 and 404 are JSON without stack, paths or SQL', async () => {
      const recruiter = await t.login();
      const responses = [
        await request(t.server()).get('/api/v1/me'),
        await request(t.server())
          .get('/api/v1/admin/visits')
          .set('Cookie', recruiter),
        await request(t.server())
          .get('/api/v1/unknown')
          .set('Cookie', recruiter),
        await request(t.server())
          .post('/api/v1/probe')
          .set('Origin', 'https://evil.example.test'),
      ];
      expect(responses.map((r) => r.status)).toEqual([401, 403, 404, 403]);
      for (const res of responses) {
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        const text = JSON.stringify(res.body);
        expect(text).not.toMatch(/stack/i);
        expect(text).not.toMatch(/node_modules|\/src\/|\.ts\b|\.js\b/);
        expect(text).not.toMatch(/SELECT|INSERT|UPDATE|FROM\s/);
      }
    });
  });

  describe('guard order', () => {
    it('Origin runs before auth: a forged POST gets 403, not 401', async () => {
      await request(t.server())
        .post('/api/v1/probe')
        .set('Origin', 'https://evil.example.test')
        .expect(403);
    });

    it('with a good Origin and no session a POST gets 401', async () => {
      await request(t.server())
        .post('/api/v1/probe')
        .set('Origin', 'https://app.example.test')
        .expect(401);
    });
  });
});
