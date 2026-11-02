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
    const ROUTE = '/api/v1/admin/visits';
    const BODY_KEYS = ['code', 'error', 'message', 'statusCode'];
    const NOW = new Date('2026-03-01T10:00:00.000Z');

    interface Item {
      id: string;
      kind: string;
      occurredAt: string;
      recruiter: { company: string | null; name: string | null };
    }
    interface Page {
      items: Item[];
      next: string | null;
    }

    const uuid = (n: number): string =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const at = (secondsAgo: number): Date =>
      new Date(NOW.getTime() - secondsAgo * 1000);

    let adminCookie: string;

    beforeEach(async () => {
      t.clock.set(NOW);
      adminCookie = await t.login({
        id: 'admin-1',
        email: 'admin@example.test',
        role: 'ADMIN',
      });
      await t.login({
        id: 'rec-1',
        email: 'ana@example.test',
        company: 'Acme',
        name: 'Ana',
      });
      await t.login({
        id: 'rec-2',
        email: 'bruno@example.test',
        company: null,
        name: null,
      });
    });

    const seed = (
      n: number,
      secondsAgo: number,
      kind: 'LOGIN' | 'CV_LINK' = 'LOGIN',
      userId = 'rec-1',
    ): void =>
      t.visits.seed({ id: uuid(n), userId, kind, occurredAt: at(secondsAgo) });

    const get = (qs = ''): request.Test =>
      request(t.server()).get(`${ROUTE}${qs}`).set('Cookie', adminCookie);

    describe('as an ADMIN', () => {
      it('answers 200 with an empty page when nothing was recorded', async () => {
        const res = await get().expect(200);
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        expect(res.body).toEqual({ items: [], next: null });
      });

      it('gives exactly items and next, and per item id, kind, occurredAt and recruiter', async () => {
        seed(1, 10, 'CV_LINK');
        const res = await get().expect(200);
        const body = res.body as Page;
        expect(Object.keys(body).sort()).toEqual(['items', 'next']);
        expect(body.items).toEqual([
          {
            id: uuid(1),
            kind: 'CV_LINK',
            occurredAt: at(10).toISOString(),
            recruiter: { company: 'Acme', name: 'Ana' },
          },
        ]);
        expect(Object.keys(body.items[0] ?? {}).sort()).toEqual([
          'id',
          'kind',
          'occurredAt',
          'recruiter',
        ]);
      });

      it('keeps company and name as null (present) when the recruiter has none', async () => {
        seed(1, 10, 'LOGIN', 'rec-2');
        const res = await get().expect(200);
        const raw = JSON.stringify(res.body);
        expect(raw).toContain('"recruiter":{"company":null,"name":null}');
      });

      it('lists newest first, and breaks an instant tie by id descending', async () => {
        seed(1, 30);
        seed(2, 10);
        seed(3, 20);
        seed(4, 20);
        const res = await get().expect(200);
        expect((res.body as Page).items.map((i) => i.id)).toEqual([
          uuid(2),
          uuid(4),
          uuid(3),
          uuid(1),
        ]);
      });

      it('gives 5 items by default out of 8 events, with a next link', async () => {
        for (let n = 1; n <= 8; n += 1) seed(n, n);
        const res = await get().expect(200);
        const body = res.body as Page;
        expect(body.items).toHaveLength(5);
        expect(body.next).toMatch(
          /^\/api\/v1\/admin\/visits\?cursor=[A-Za-z0-9_-]+&limit=5$/,
        );
      });

      it('keeps limit and kind in the next link, and following it lists only that kind', async () => {
        // LOGIN on odd n, CV_LINK on even n, interleaved in time.
        for (let n = 1; n <= 8; n += 1) {
          seed(n, n, n % 2 === 1 ? 'LOGIN' : 'CV_LINK');
        }
        const first = await get('?limit=2&kind=LOGIN').expect(200);
        const next = (first.body as Page).next ?? '';
        expect(next).toMatch(
          /^\/api\/v1\/admin\/visits\?cursor=[A-Za-z0-9_-]+&limit=2&kind=LOGIN$/,
        );
        const second = await request(t.server())
          .get(next)
          .set('Cookie', adminCookie)
          .expect(200);
        const items = (second.body as Page).items;
        expect(items.map((i) => i.id)).toEqual([uuid(5), uuid(7)]);
        expect(items.every((i) => i.kind === 'LOGIN')).toBe(true);
      });

      it('walks 7 events (3 tied) with limit=2 through the next links until next is null', async () => {
        seed(1, 70);
        seed(2, 60);
        seed(3, 50);
        seed(4, 50);
        seed(5, 50);
        seed(6, 40);
        seed(7, 30);
        const ids: string[] = [];
        let url: string | null = `${ROUTE}?limit=2`;
        let pages = 0;
        while (url !== null) {
          const res: request.Response = await request(t.server())
            .get(url)
            .set('Cookie', adminCookie)
            .expect(200);
          const page = res.body as Page;
          ids.push(...page.items.map((i) => i.id));
          url = page.next;
          pages += 1;
        }
        expect(pages).toBe(4);
        expect(ids).toEqual([7, 6, 5, 4, 3, 2, 1].map(uuid));
      });

      it('filters by kind', async () => {
        seed(1, 30, 'LOGIN');
        seed(2, 20, 'CV_LINK');
        seed(3, 10, 'LOGIN');
        const login = await get('?kind=LOGIN').expect(200);
        expect((login.body as Page).items.map((i) => i.id)).toEqual([
          uuid(3),
          uuid(1),
        ]);
        const cv = await get('?kind=CV_LINK').expect(200);
        expect((cv.body as Page).items.map((i) => i.id)).toEqual([uuid(2)]);
      });

      it('answers an empty page for a cursor placed after the last item', async () => {
        seed(1, 20);
        seed(2, 10);
        const first = await get('?limit=1').expect(200);
        const next = (first.body as Page).next ?? '';
        const second = await request(t.server())
          .get(next)
          .set('Cookie', adminCookie)
          .expect(200);
        expect((second.body as Page).items.map((i) => i.id)).toEqual([uuid(1)]);
        expect((second.body as Page).next).toBeNull();
        const last = (second.body as Page).items[0];
        const afterLast = Buffer.from(
          `${new Date(last?.occurredAt ?? '').getTime()}.${last?.id}`,
        ).toString('base64url');
        const empty = await get(`?cursor=${afterLast}`).expect(200);
        expect(empty.body).toEqual({ items: [], next: null });
      });

      it('does not list events older than the retention window', async () => {
        t.visits.seed({
          id: uuid(1),
          userId: 'rec-1',
          kind: 'LOGIN',
          occurredAt: new Date(NOW.getTime() - 181 * 24 * 60 * 60 * 1000),
        });
        seed(2, 10);
        const res = await get().expect(200);
        expect((res.body as Page).items.map((i) => i.id)).toEqual([uuid(2)]);
      });

      it('exposes no email, IP, user agent or user id', async () => {
        seed(1, 10, 'LOGIN', 'rec-1');
        const res = await get()
          .set('User-Agent', 'ua-marker-probe')
          .expect(200);
        const raw = JSON.stringify(res.body);
        expect(raw).not.toMatch(
          /"(email|ip|ipAddress|userAgent|user_agent|userId|user_id)"|@example\.test|rec-1|ua-marker/i,
        );
      });
    });

    describe('invalid query', () => {
      const BAD = [
        'limit=abc',
        'limit=0',
        'limit=51',
        'limit=2.5',
        'limit=',
        'limit=1&limit=2',
        'kind=login',
        'kind=OTHER',
        'kind=',
        'kind=A&kind=B',
        `cursor=${encodeURIComponent('<script>')}`,
        'cursor=%25%25%25',
        'cursor=',
        'cursor=texto',
        `cursor=${Buffer.from(`8640000000000001.${uuid(1)}`).toString('base64url')}`,
        `cursor=${Buffer.from('1700000000000.not-a-uuid').toString('base64url')}`,
        'cursor=abc&cursor=def',
      ];

      it.each(BAD)('answers 400 INVALID_INPUT for %s', async (qs) => {
        seed(1, 10);
        const res = await get(`?${qs}`);
        expect(res.status).toBe(400);
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        const body = res.body as Record<string, unknown>;
        expect(Object.keys(body).sort()).toEqual(BODY_KEYS);
        expect(body['code']).toBe('INVALID_INPUT');
        const raw = JSON.stringify(body);
        for (const marker of ['script', 'texto', 'OTHER', 'abc', 'login']) {
          expect(raw).not.toContain(marker);
        }
      });
    });

    describe('access', () => {
      it('answers 403 ROLE_NOT_ALLOWED to a RECRUITER, with no events and no query to the store', async () => {
        seed(1, 10);
        const spy = jest.spyOn(t.visits, 'listPage');
        const cookie = await t.login({ role: 'RECRUITER' });
        const res = await request(t.server())
          .get(ROUTE)
          .set('Cookie', cookie)
          .expect(403);
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        expect(res.body).toMatchObject({
          statusCode: 403,
          code: 'ROLE_NOT_ALLOWED',
        });
        expect(res.body).not.toHaveProperty('items');
        expect(JSON.stringify(res.body)).not.toContain(uuid(1));
        expect(spy).not.toHaveBeenCalled();
      });

      it('answers 401 UNAUTHENTICATED without a session', async () => {
        const res = await request(t.server()).get(ROUTE).expect(401);
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        expect(res.body).toMatchObject({
          statusCode: 401,
          code: 'UNAUTHENTICATED',
        });
      });
    });

    describe('caching', () => {
      it('sends Cache-Control: no-store on 200, 400, 401 and 403', async () => {
        const recruiter = await t.login({ role: 'RECRUITER' });
        const responses = [
          await get(),
          await get('?limit=0'),
          await request(t.server()).get(ROUTE),
          await request(t.server()).get(ROUTE).set('Cookie', recruiter),
        ];
        expect(responses.map((r) => r.status)).toEqual([200, 400, 401, 403]);
        for (const res of responses) {
          expect(res.headers['cache-control']).toBe('no-store');
        }
      });
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
