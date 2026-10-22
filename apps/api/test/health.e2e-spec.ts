import request from 'supertest';
import { HEALTH_PROBES } from '../src/health/application/ports/health-probe.port';
import { createTestApp, type TestApp } from './support/test-app';

describe('health (e2e)', () => {
  let t: TestApp;

  afterEach(() => t.close());

  async function createApp(probes?: unknown): Promise<void> {
    t = await createTestApp({
      customize: (builder) =>
        probes
          ? builder.overrideProvider(HEALTH_PROBES).useValue(probes)
          : builder,
    });
  }

  it('GET /api/health returns the contract without caching', async () => {
    await createApp();
    const res = await request(t.server()).get('/api/health').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      status: 'ok',
      checks: [{ name: 'process', status: 'ok' }],
    });
  });

  it('GET /health is not found outside the global prefix', async () => {
    await createApp();
    await request(t.server()).get('/health').expect(404);
  });

  it('reports degraded when a probe is down', async () => {
    await createApp([
      { check: () => Promise.resolve({ name: 'process', status: 'ok' }) },
      { check: () => Promise.resolve({ name: 'db', status: 'down' }) },
    ]);
    const res = await request(t.server()).get('/api/health').expect(200);
    expect((res.body as { status: string }).status).toBe('degraded');
  });
});
