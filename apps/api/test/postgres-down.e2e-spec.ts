import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app';
import { TEST_ORIGIN } from './support/test-config';

/** A DataSource that behaves like Postgres being down, then coming back. */
class FlakyDataSource {
  isInitialized = false;
  up = false;
  initializeCalls = 0;

  initialize(): Promise<this> {
    this.initializeCalls += 1;
    if (!this.up)
      return Promise.reject(new Error('connect ECONNREFUSED 10.0.0.9:5432'));
    this.isInitialized = true;
    return Promise.resolve(this);
  }

  query(sql: string): Promise<unknown[]> {
    if (!sql.includes('INSERT INTO users')) return Promise.resolve([]);
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
    });
    expect(JSON.stringify(down.body)).not.toContain('10.0.0.9');
    expect(down.headers['set-cookie']).toBeUndefined();

    db.up = true;
    const recovered = await verifyNewLink();
    expect(recovered.status).toBe(204);
    expect(recovered.headers['set-cookie']).toHaveLength(2);
  });
});
