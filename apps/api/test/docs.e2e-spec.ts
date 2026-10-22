import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, type TestApp } from './support/test-app';

interface SchemaWithStatus {
  properties: { status: { enum: string[] } };
}

interface OpenApiDocument {
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, SchemaWithStatus> };
}

describe('docs (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(() => t.close());

  const server = (): App => t.server();

  it('GET /api/docs serves the Swagger UI as HTML', async () => {
    const res = await request(server()).get('/api/docs').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('GET /api/docs-json documents GET /api/health with its schema', async () => {
    const res = await request(server()).get('/api/docs-json').expect(200);
    const doc = res.body as OpenApiDocument;
    expect(doc.paths['/api/health']).toHaveProperty('get');
    expect(doc.components.schemas).toHaveProperty('HealthResponseDto');
    expect(doc.components.schemas).toHaveProperty('HealthCheckDto');
    const { HealthResponseDto, HealthCheckDto } = doc.components.schemas;
    expect(HealthResponseDto?.properties.status.enum).toEqual([
      'ok',
      'degraded',
      'down',
    ]);
    expect(HealthCheckDto?.properties.status.enum).toEqual(['ok', 'down']);
  });
});
