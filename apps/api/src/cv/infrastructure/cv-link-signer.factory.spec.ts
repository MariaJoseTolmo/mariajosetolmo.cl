import { testConfig } from '../../../test/support/test-config';
import { FakeCvLinkSigner } from './fake-cv-link.signer';
import { createCvLinkSigner } from './cv-link-signer.factory';
import { S3CvLinkSigner } from './s3-cv-link.signer';

const NOW = new Date('2026-03-01T10:00:00.000Z');

describe('createCvLinkSigner', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    // Obviously fake credentials for the SDK default chain; nothing is sent.
    process.env['AWS_ACCESS_KEY_ID'] = 'fake-access-key-id';
    process.env['AWS_SECRET_ACCESS_KEY'] = 'fake-secret-for-offline-presigning';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('builds the fake signer with the configured lifetime', async () => {
    const signer = createCvLinkSigner(
      testConfig({
        cv: { signer: 'fake', bucket: null, objectKey: null, ttlSeconds: 90 },
      }),
    );
    expect(signer).toBeInstanceOf(FakeCvLinkSigner);
    expect((await signer.sign(NOW)).expiresAt.toISOString()).toBe(
      '2026-03-01T10:01:30.000Z',
    );
  });

  it('builds the S3 signer from bucket, key, lifetime and region, offline', async () => {
    const signer = createCvLinkSigner(
      testConfig({
        awsRegion: 'us-east-1',
        cv: {
          signer: 's3',
          bucket: 'example-cv-bucket',
          objectKey: 'cv/example.pdf',
          ttlSeconds: 120,
        },
      }),
    );
    expect(signer).toBeInstanceOf(S3CvLinkSigner);
    const link = await signer.sign(NOW);
    const url = new URL(link.url);
    expect(url.hostname).toBe('example-cv-bucket.s3.us-east-1.amazonaws.com');
    expect(url.pathname).toBe('/cv/example.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(link.expiresAt.toISOString()).toBe('2026-03-01T10:02:00.000Z');
  });

  it('refuses an s3 configuration without bucket or key instead of serving example links', () => {
    expect(() =>
      createCvLinkSigner(
        testConfig({
          cv: { signer: 's3', bucket: null, objectKey: 'k', ttlSeconds: 300 },
        }),
      ),
    ).toThrow(/CV_BUCKET/);
    expect(() =>
      createCvLinkSigner(
        testConfig({
          cv: { signer: 's3', bucket: 'b', objectKey: null, ttlSeconds: 300 },
        }),
      ),
    ).toThrow(/CV_OBJECT_KEY/);
  });
});
