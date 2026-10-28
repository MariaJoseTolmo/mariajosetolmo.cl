import request from 'supertest';
import { contentViolations } from './support/content-rules';
import { createTestApp, type TestApp } from './support/test-app';

const JSON_TYPE = /application\/json/;
const LEVELS = ['advanced', 'production', 'architecture', 'learning'];

interface Page {
  items: Array<Record<string, unknown>>;
  next: string | null;
}

describe('content endpoints (e2e)', () => {
  let t: TestApp;
  let cookie: string;

  beforeEach(async () => {
    t = await createTestApp();
    cookie = await t.login();
  });
  afterEach(() => t.close());

  const get = (path: string, session: string | null = cookie): request.Test => {
    const req = request(t.server()).get(path);
    return session ? req.set('Cookie', session) : req;
  };

  describe('session and caching', () => {
    it.each(['/api/v1/profile', '/api/v1/experience', '/api/v1/skills'])(
      '%s answers 401 JSON without a session',
      async (path) => {
        const res = await get(path, null).expect(401);
        expect(res.headers['content-type']).toMatch(JSON_TYPE);
        expect(res.headers['cache-control']).toBe('no-store');
      },
    );

    it.each([
      ['/api/v1/profile', 200],
      ['/api/v1/experience', 200],
      ['/api/v1/experience?limit=abc', 400],
      ['/api/v1/skills', 200],
      ['/api/v1/skills?level=expert', 400],
    ])('%s answers %i with Cache-Control: no-store', async (path, status) => {
      const res = await get(path).expect(status);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
    });
  });

  describe('GET /api/v1/profile', () => {
    it('returns exactly the five public keys', async () => {
      const res = await get('/api/v1/profile').expect(200);
      const body = res.body as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual([
        'architecture',
        'domains',
        'name',
        'openToWork',
        'role',
      ]);
      expect(typeof body.openToWork).toBe('boolean');
      expect(body.domains).toEqual(['web', 'cloud']);
    });

    it('answers 503 JSON without internals when there is no profile row', async () => {
      t.content.set({});
      const res = await get('/api/v1/profile').expect(503);
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
      expect(JSON.stringify(res.body)).not.toMatch(/stack|SELECT/i);
    });
  });

  describe('GET /api/v1/skills', () => {
    it('returns level and skills for a valid level', async () => {
      const res = await get('/api/v1/skills?level=advanced').expect(200);
      const body = res.body as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['level', 'skills']);
      expect(body).toEqual({
        level: 'advanced',
        skills: ['TypeScript', 'Angular'],
      });
    });

    it('returns only "levels" with the four groups without a level', async () => {
      const res = await get('/api/v1/skills').expect(200);
      const body = res.body as { levels: Array<Record<string, unknown>> };
      expect(Object.keys(body)).toEqual(['levels']);
      expect(body.levels.map((g) => g.level)).toEqual(LEVELS);
      for (const group of body.levels) {
        expect(Object.keys(group).sort()).toEqual(['level', 'skills']);
      }
    });

    it.each(['expert', ''])(
      'level=%j answers 400 INVALID_INPUT without echo',
      async (level) => {
        const res = await get(`/api/v1/skills?level=${level}`).expect(400);
        expect(res.body).toEqual({
          statusCode: 400,
          error: 'Bad Request',
          message: 'level is not a known skill level',
        });
      },
    );
  });

  describe('GET /api/v1/experience', () => {
    const EXPERIENCE_KEYS = [
      'company',
      'highlights',
      'id',
      'period',
      'role',
      'sector',
      'technologies',
    ];

    it('returns the five items and next null by default', async () => {
      const res = await get('/api/v1/experience').expect(200);
      const body = res.body as Page;
      expect(Object.keys(body).sort()).toEqual(['items', 'next']);
      expect(body.items.map((i) => i.id)).toEqual([
        'entry-1',
        'entry-2',
        'entry-3',
        'entry-4',
        'entry-5',
      ]);
      expect(body.next).toBeNull();
    });

    it('serves exactly the seven public keys per item, without position', async () => {
      const res = await get('/api/v1/experience').expect(200);
      const { items } = res.body as Page;
      expect(items).toHaveLength(5);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual(EXPERIENCE_KEYS);
        expect(item).not.toHaveProperty('position');
      }
      expect(items[0]?.period).toBe('Period 1');
      expect(items[1]?.technologies).toEqual([]);
    });

    it('limit=2 gives two items and a next URL keeping the limit', async () => {
      const res = await get('/api/v1/experience?limit=2').expect(200);
      const body = res.body as Page;
      expect(body.items.map((i) => i.id)).toEqual(['entry-1', 'entry-2']);
      expect(body.next).toBe('/api/v1/experience?cursor=2&limit=2');
    });

    it('following next to the end visits every item once', async () => {
      const seen: unknown[] = [];
      let url: string | null = '/api/v1/experience?limit=2';
      let pages = 0;
      while (url) {
        const res: request.Response = await get(url).expect(200);
        const body = res.body as Page;
        seen.push(...body.items.map((i) => i.id));
        url = body.next;
        pages += 1;
      }
      expect(pages).toBe(3);
      expect(seen).toEqual([
        'entry-1',
        'entry-2',
        'entry-3',
        'entry-4',
        'entry-5',
      ]);
    });

    it.each(['1', '50'])('limit=%s is valid', async (limit) => {
      await get(`/api/v1/experience?limit=${limit}`).expect(200);
    });

    it('a cursor beyond the last position gives an empty last page', async () => {
      const res = await get(
        '/api/v1/experience?cursor=9007199254740991',
      ).expect(200);
      expect(res.body).toEqual({ items: [], next: null });
    });

    it.each([
      'limit=abc',
      'limit=0',
      'limit=51',
      'limit=2.5',
      'limit=',
      'limit=1&limit=2',
      'cursor=-1',
      'cursor=abc',
      'cursor=%3Cscript%3E',
      'cursor=9007199254740993',
    ])('%s answers 400 INVALID_INPUT without echoing the input', async (qs) => {
      const res = await get(`/api/v1/experience?${qs}`).expect(400);
      expect(res.headers['content-type']).toMatch(JSON_TYPE);
      // The whole body is a fixed message per parameter, so an exact match
      // proves nothing from the request is echoed (even short values).
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: qs.startsWith('limit')
          ? 'limit must be an integer between 1 and 50'
          : 'cursor must be a non-negative integer',
      });
    });
  });

  describe('forbidden content scan', () => {
    it.each(['/api/v1/profile', '/api/v1/experience', '/api/v1/skills'])(
      '%s body has no salary, phone, availability, email or CV file',
      async (path) => {
        const res = await get(path).expect(200);
        expect(contentViolations(res.text)).toEqual([]);
      },
    );

    it('keeps openToWork a boolean in the body', async () => {
      const res = await get('/api/v1/profile').expect(200);
      expect(typeof (res.body as { openToWork: unknown }).openToWork).toBe(
        'boolean',
      );
    });
  });

  describe('Swagger', () => {
    interface Doc {
      paths: Record<
        string,
        { get: { tags: string[]; security?: Array<Record<string, string[]>> } }
      >;
    }

    it('documents the three routes under the content tag, none under /admin', async () => {
      const res = await request(t.server()).get('/api/docs-json').expect(200);
      const { paths } = res.body as Doc;
      for (const path of [
        '/api/v1/profile',
        '/api/v1/experience',
        '/api/v1/skills',
      ]) {
        expect(paths[path]?.get.tags).toEqual(['content']);
        expect(paths[path]?.get.security).toContainEqual({
          'access-cookie': [],
        });
      }
      expect(
        Object.keys(paths).filter((p) => p.startsWith('/api/v1/admin')),
      ).toEqual([]);
    });

    it('documents the experience and skills query parameters', async () => {
      const res = await request(t.server()).get('/api/docs-json').expect(200);
      const params = (path: string): Array<Record<string, unknown>> =>
        ((
          res.body as {
            paths: Record<string, { get: { parameters: unknown[] } }>;
          }
        ).paths[path]?.get.parameters ?? []) as Array<Record<string, unknown>>;
      const limit = params('/api/v1/experience').find(
        (p) => p.name === 'limit',
      );
      expect(limit).toMatchObject({
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
      });
      const cursor = params('/api/v1/experience').find(
        (p) => p.name === 'cursor',
      );
      expect(cursor).toMatchObject({ schema: { type: 'integer', minimum: 0 } });
      const level = params('/api/v1/skills').find((p) => p.name === 'level');
      expect(level).toMatchObject({
        schema: { enum: LEVELS },
      });
      const ok = (
        res.body as {
          paths: Record<
            string,
            { get: { responses: Record<string, { content: unknown }> } }
          >;
        }
      ).paths['/api/v1/skills']?.get.responses['200'];
      expect(ok?.content).toMatchObject({
        'application/json': {
          schema: {
            oneOf: [
              { $ref: '#/components/schemas/SkillGroupDto' },
              { $ref: '#/components/schemas/SkillLevelsDto' },
            ],
          },
        },
      });
    });
  });
});
