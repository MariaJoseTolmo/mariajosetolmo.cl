import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { HEALTH_PROBES } from '../src/health/application/ports/health-probe.port';

describe('health (e2e)', () => {
  let app: INestApplication;

  afterEach(() => app.close());

  async function createApp(probes?: unknown): Promise<void> {
    const builder = Test.createTestingModule({ imports: [AppModule] });
    if (probes) builder.overrideProvider(HEALTH_PROBES).useValue(probes);
    app = configureApp((await builder.compile()).createNestApplication());
    await app.init();
  }

  it('GET /api/health returns the contract without caching', async () => {
    await createApp();
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      status: 'ok',
      checks: [{ name: 'process', status: 'ok' }],
    });
  });

  it('GET /health is not found outside the global prefix', async () => {
    await createApp();
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('reports degraded when a probe is down', async () => {
    await createApp([
      { check: async () => ({ name: 'process', status: 'ok' }) },
      { check: async () => ({ name: 'db', status: 'down' }) },
    ]);
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body.status).toBe('degraded');
  });
});
