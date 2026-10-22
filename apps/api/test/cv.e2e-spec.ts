import request from 'supertest';
import { CV_LINK_SIGNER } from '../src/cv/application/ports/cv-link-signer.port';
import { InfrastructureUnavailable } from '../src/shared/domain/errors';
import { FakeCvLinkSigner } from './support/fakes/fake-cv-link.signer';
import { createTestApp, type TestApp } from './support/test-app';

describe('GET /api/v1/cv (e2e)', () => {
  let t: TestApp;
  let signer: FakeCvLinkSigner;

  beforeEach(async () => {
    signer = new FakeCvLinkSigner(300);
    t = await createTestApp({
      customize: (builder) =>
        builder.overrideProvider(CV_LINK_SIGNER).useValue(signer),
    });
  });
  afterEach(() => t.close());

  const getCv = (cookie?: string): request.Test => {
    const req = request(t.server()).get('/api/v1/cv');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('returns exactly url and expiresAt (clock + 300 s, ISO UTC), uncached', async () => {
    const cookie = await t.login();
    const res = await getCv(cookie).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.body as { url: string; expiresAt: string };
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'url']);
    expect(body.url).toMatch(/^https:\/\/cv\.example\.test\//);
    expect(body.expiresAt).toBe(
      new Date(t.clock.now().getTime() + 300_000).toISOString(),
    );
  });

  it('works for an administrator too, and follows the clock', async () => {
    const cookie = await t.login({
      email: 'admin@example.test',
      role: 'ADMIN',
    });
    t.clock.advanceSeconds(120);
    const res = await getCv(cookie).expect(200);
    expect((res.body as { expiresAt: string }).expiresAt).toBe(
      '2026-01-01T00:07:00.000Z',
    );
  });

  it('asks the signer on every request: two requests, two links', async () => {
    const cookie = await t.login();
    const first = await getCv(cookie).expect(200);
    t.clock.advanceSeconds(5);
    const second = await getCv(cookie).expect(200);
    expect(signer.calls).toBe(2);
    expect((second.body as { url: string }).url).not.toBe(
      (first.body as { url: string }).url,
    );
  });

  it('answers 401 JSON without a session, and never calls the signer', async () => {
    const res = await getCv().expect(401);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\(/);
    expect(signer.calls).toBe(0);
  });

  it('answers 401 for a garbage cookie, and never calls the signer', async () => {
    await getCv('__Host-access=not-a-token').expect(401);
    expect(signer.calls).toBe(0);
  });

  it('never writes the url to the logs', async () => {
    const cookie = await t.login();
    const res = await getCv(cookie).expect(200);
    const url = (res.body as { url: string }).url;
    const logged = JSON.stringify([t.logger.errors, t.logger.warnings]);
    expect(logged).not.toContain(url);
    expect(logged).not.toContain('cv.example.test');
  });

  it('is documented with the cookie scheme and without secrets', async () => {
    const res = await request(t.server()).get('/api/docs-json').expect(200);
    const doc = res.body as { paths: Record<string, unknown> };
    expect(doc.paths['/api/v1/cv']).toHaveProperty('get');
    expect(
      Object.keys(doc.paths).some((p) => p.startsWith('/api/v1/admin')),
    ).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(
      /X-Amz-Signature|__Secure-refresh=/,
    );
  });
});

describe('GET /api/v1/cv with the configured signer (e2e)', () => {
  it('serves the example link when no signer is overridden (local default)', async () => {
    const t = await createTestApp();
    try {
      const cookie = await t.login();
      const res = await request(t.server())
        .get('/api/v1/cv')
        .set('Cookie', cookie)
        .expect(200);
      expect((res.body as { url: string }).url).toMatch(
        /^https:\/\/cv\.example\.test\/cv-de-ejemplo\.pdf\?expires=\d+$/,
      );
    } finally {
      await t.close();
    }
  });

  it('answers 503 with a generic body when the signer fails', async () => {
    const t = await createTestApp({
      customize: (builder) =>
        builder.overrideProvider(CV_LINK_SIGNER).useValue({
          sign: () =>
            Promise.reject(
              new InfrastructureUnavailable(new Error('credentials: bucket-x')),
            ),
        }),
    });
    try {
      const cookie = await t.login();
      const res = await request(t.server())
        .get('/api/v1/cv')
        .set('Cookie', cookie);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
      });
    } finally {
      await t.close();
    }
  });
});
