import { InfrastructureUnavailable } from '../../shared/domain/errors';
import { S3CvLinkSigner, type Presign } from './s3-cv-link.signer';

const NOW = new Date('2026-03-01T10:00:00.000Z');

interface Call {
  bucket: string;
  key: string;
  expiresInSeconds: number;
  signingDate: Date;
}

function recordingPresign(
  calls: Call[],
  url = 'https://signed.example.test/x',
): Presign {
  return (input) => {
    calls.push(input);
    return Promise.resolve(url);
  };
}

describe('S3CvLinkSigner', () => {
  it('presigns the configured object with the configured lifetime, at the given instant', async () => {
    const calls: Call[] = [];
    const signer = new S3CvLinkSigner(
      { bucket: 'example-cv-bucket', key: 'cv/example.pdf', ttlSeconds: 300 },
      recordingPresign(calls, 'https://signed.example.test/one'),
    );
    const link = await signer.sign(NOW);
    expect(calls).toEqual([
      {
        bucket: 'example-cv-bucket',
        key: 'cv/example.pdf',
        expiresInSeconds: 300,
        signingDate: NOW,
      },
    ]);
    expect(link.url).toBe('https://signed.example.test/one');
    expect(link.expiresAt.toISOString()).toBe('2026-03-01T10:05:00.000Z');
  });

  it('follows a different object, lifetime and instant', async () => {
    const calls: Call[] = [];
    const signer = new S3CvLinkSigner(
      { bucket: 'other-bucket', key: 'docs/other.pdf', ttlSeconds: 45 },
      recordingPresign(calls),
    );
    const later = new Date('2026-12-31T23:59:50.000Z');
    const link = await signer.sign(later);
    expect(calls[0]).toEqual({
      bucket: 'other-bucket',
      key: 'docs/other.pdf',
      expiresInSeconds: 45,
      signingDate: later,
    });
    expect(link.expiresAt.toISOString()).toBe('2027-01-01T00:00:35.000Z');
  });

  it('presigns on every call (a new link each time)', async () => {
    const calls: Call[] = [];
    const signer = new S3CvLinkSigner(
      { bucket: 'b', key: 'k', ttlSeconds: 300 },
      recordingPresign(calls),
    );
    await signer.sign(NOW);
    await signer.sign(NOW);
    expect(calls).toHaveLength(2);
  });

  it('fails closed with a generic error that carries no bucket, key or url', async () => {
    const signer = new S3CvLinkSigner(
      { bucket: 'secret-bucket-name', key: 'private/key.pdf', ttlSeconds: 300 },
      () =>
        Promise.reject(
          new Error('credentials provider failed for secret-bucket-name'),
        ),
    );
    const error: unknown = await signer.sign(NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InfrastructureUnavailable);
    const text = String((error as Error).message);
    expect(text).toBe('Service temporarily unavailable');
    expect(text).not.toContain('secret-bucket-name');
    expect(text).not.toContain('private/key.pdf');
  });
});
