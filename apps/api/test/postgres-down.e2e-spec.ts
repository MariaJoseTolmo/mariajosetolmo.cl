import request from 'supertest';
import { sha256Hex } from '../src/shared/domain/hash';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

/** A DataSource that behaves like Postgres being down, then coming back. */
class FlakyDataSource {
  isInitialized = false;
  up = false;
  initializeCalls = 0;
  availabilityRow: Record<string, string> | null = {
    modality: 'db modality',
    start_label: 'db start',
    salary: 'db salary',
  };
  profileRow: Record<string, unknown> | null = {
    name: 'Db Name',
    role: 'Db Role',
    architecture: 'db architecture',
    domains: ['db-domain'],
    open_to_work: true,
  };
  readonly statements: { sql: string; params: unknown[] }[] = [];

  initialize(): Promise<this> {
    this.initializeCalls += 1;
    if (!this.up)
      return Promise.reject(new Error('connect ECONNREFUSED 10.0.0.9:5432'));
    this.isInitialized = true;
    return Promise.resolve(this);
  }

  query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    this.statements.push({ sql, params });
    if (sql.includes('FROM availability')) {
      return Promise.resolve(
        this.availabilityRow ? [this.availabilityRow] : [],
      );
    }
    if (sql.includes('FROM profile')) {
      return Promise.resolve(this.profileRow ? [this.profileRow] : []);
    }
    if (sql.includes('FROM experience')) {
      return Promise.resolve([
        {
          id: 'db-entry',
          position: 1,
          company: 'Db Company',
          role: 'Db Role',
          sector: 'Db Sector',
          period_label: 'Db Period',
          highlights: ['db highlight'],
          technologies: [],
        },
      ]);
    }
    if (sql.includes('FROM skill')) {
      return Promise.resolve([{ level: 'advanced', name: 'Db Skill' }]);
    }
    if (!sql.includes('INSERT INTO users') && !sql.includes('FROM users')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        email: 'a@example.test',
        role: 'RECRUITER',
        company: null,
        name: null,
      },
    ]);
  }

  destroy(): Promise<void> {
    this.isInitialized = false;
    return Promise.resolve();
  }
}

describe('Postgres unreachable at boot', () => {
  let t: TestApp;
  let db: FlakyDataSource;

  beforeEach(async () => {
    db = new FlakyDataSource();
    t = await createTestApp({
      dataSource: db,
      config: { clientIpSource: 'socket' },
    });
  });
  afterEach(() => t.close());

  const verifyNewLink = async (): Promise<request.Response> => {
    await request(t.server())
      .post('/api/auth/magic-link')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'a@example.test' })
      .expect(202);
    return request(t.server())
      .post('/api/auth/verify')
      .set('Origin', TEST_ORIGIN)
      .send({ token: t.mail.lastToken() });
  };

  it('boots without touching the database, and keeps serving health and the JWKS', async () => {
    expect(db.initializeCalls).toBe(0);
    await request(t.server()).get('/api/health').expect(200);
    const jwks = await request(t.server())
      .get('/api/.well-known/jwks.json')
      .expect(200);
    expect((jwks.body as { keys: unknown[] }).keys).toHaveLength(1);
    expect(db.initializeCalls).toBe(0);
  });

  it('answers verify 503 with a generic body while down, and works after recovery', async () => {
    const down = await verifyNewLink();
    expect(down.status).toBe(503);
    expect(down.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(JSON.stringify(down.body)).not.toContain('10.0.0.9');
    expect(down.headers['set-cookie']).toBeUndefined();

    db.up = true;
    const recovered = await verifyNewLink();
    expect(recovered.status).toBe(204);
    expect(recovered.headers['set-cookie']).toHaveLength(2);
  });

  it('writes the refresh token row through the DataSource (hash only), not in memory', async () => {
    db.up = true;
    const res = await verifyNewLink();
    expect(res.status).toBe(204);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refresh = (
      cookies.find((c) => c.startsWith('__Secure-refresh=')) ?? ''
    )
      .split(';')[0]
      ?.slice('__Secure-refresh='.length);
    const inserts = db.statements.filter((s) =>
      s.sql.includes('INSERT INTO refresh_tokens'),
    );
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.params).toContain(sha256Hex(refresh ?? ''));
    expect(JSON.stringify(inserts[0]?.params)).not.toContain(refresh);
  });

  describe('availability in GET /api/v1/me', () => {
    const signIn = async (): Promise<string> => {
      const res = await verifyNewLink();
      expect(res.status).toBe(204);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      return cookies
        .map((c) => c.split(';')[0] ?? '')
        .filter((c) => c.startsWith('__Host-access='))
        .join('; ');
    };

    it('reads the labels from the table, start_label exposed as start', async () => {
      db.up = true;
      const cookie = await signIn();
      const res = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', cookie)
        .expect(200);
      expect((res.body as { availability: unknown }).availability).toEqual({
        modality: 'db modality',
        start: 'db start',
        salary: 'db salary',
      });
      expect(
        db.statements.some((s) => s.sql.includes('FROM availability')),
      ).toBe(true);
    });

    it('answers 503 with a generic body when the availability row is missing', async () => {
      db.up = true;
      const cookie = await signIn();
      db.availabilityRow = null;
      const res = await request(t.server())
        .get('/api/v1/me')
        .set('Cookie', cookie);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });

  describe.each([
    ['/api/v1/profile', /FROM profile\b/, 'Db Name'],
    ['/api/v1/experience', /FROM experience\b/, 'Db Company'],
    ['/api/v1/skills', /FROM skill\b/, 'Db Skill'],
  ] as const)('content route %s', (path, table, marker) => {
    it('answers 503 with a generic no-store body while Postgres is down', async () => {
      const cookie = await t.login();
      const res = await request(t.server()).get(path).set('Cookie', cookie);
      expect(res.status).toBe(503);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/10\.0\.0\.9|ECONNREFUSED|SELECT|stack/);
    });

    it('serves from the database after recovery', async () => {
      db.up = true;
      const cookie = await t.login();
      const res = await request(t.server()).get(path).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(marker);
      expect(db.statements.some((s) => table.test(s.sql))).toBe(true);
    });
  });

  it('answers profile 503 when the profile row is missing', async () => {
    db.up = true;
    db.profileRow = null;
    const cookie = await t.login();
    const res = await request(t.server())
      .get('/api/v1/profile')
      .set('Cookie', cookie);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
