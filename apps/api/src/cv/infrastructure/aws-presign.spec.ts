import { S3Client } from '@aws-sdk/client-s3';
import { createAwsPresign } from './aws-presign';

// Obviously fake, offline credentials: presigning is a local computation.
const FAKE_SECRET = 'fake-secret-for-offline-presigning';
function client(region = 'us-east-1'): S3Client {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: 'fake-access-key-id',
      secretAccessKey: FAKE_SECRET,
    },
  });
}

describe('createAwsPresign (real SDK, no network)', () => {
  it('builds a GET url for the private object with the requested expiry and instant', async () => {
    const presign = createAwsPresign(client());
    const url = new URL(
      await presign({
        bucket: 'example-cv-bucket',
        key: 'cv/example.pdf',
        expiresInSeconds: 300,
        signingDate: new Date('2026-03-01T10:00:00.000Z'),
      }),
    );
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('example-cv-bucket.s3.us-east-1.amazonaws.com');
    expect(url.pathname).toBe('/cv/example.pdf');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20260301T100000Z');
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'fake-access-key-id/20260301/us-east-1/s3/aws4_request',
    );
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain(FAKE_SECRET);
  });

  it('changes with the instant, the lifetime, the region and the key', async () => {
    const first = await createAwsPresign(client())({
      bucket: 'example-cv-bucket',
      key: 'cv/example.pdf',
      expiresInSeconds: 300,
      signingDate: new Date('2026-03-01T10:00:00.000Z'),
    });
    const second = new URL(
      await createAwsPresign(client('sa-east-1'))({
        bucket: 'example-cv-bucket',
        key: 'other folder/otro.pdf',
        expiresInSeconds: 60,
        signingDate: new Date('2026-12-31T23:59:50.000Z'),
      }),
    );
    expect(second.hostname).toBe(
      'example-cv-bucket.s3.sa-east-1.amazonaws.com',
    );
    expect(second.pathname).toBe('/other%20folder/otro.pdf');
    expect(second.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(second.searchParams.get('X-Amz-Date')).toBe('20261231T235950Z');
    expect(second.searchParams.get('X-Amz-Signature')).not.toBe(
      new URL(first).searchParams.get('X-Amz-Signature'),
    );
  });
});
