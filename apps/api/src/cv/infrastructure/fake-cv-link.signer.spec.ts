import { FakeCvLinkSigner } from './fake-cv-link.signer';

describe('FakeCvLinkSigner', () => {
  const NOW = new Date('2026-03-01T10:00:00.000Z');

  it('returns an example url and now + ttl', async () => {
    const link = await new FakeCvLinkSigner(300).sign(NOW);
    expect(link.url).toBe(
      `https://cv.example.test/cv-de-ejemplo.pdf?expires=${NOW.getTime() / 1000 + 300}`,
    );
    expect(link.expiresAt.toISOString()).toBe('2026-03-01T10:05:00.000Z');
  });

  it('uses the configured lifetime and counts its calls', async () => {
    const signer = new FakeCvLinkSigner(90);
    const first = await signer.sign(NOW);
    const second = await signer.sign(new Date(NOW.getTime() + 1000));
    expect(first.expiresAt.toISOString()).toBe('2026-03-01T10:01:30.000Z');
    expect(second.expiresAt.toISOString()).toBe('2026-03-01T10:01:31.000Z');
    expect(second.url).not.toBe(first.url);
    expect(signer.calls).toBe(2);
  });

  it('writes whole epoch seconds in the url even when the clock has milliseconds', async () => {
    const link = await new FakeCvLinkSigner(300).sign(
      new Date('2026-03-01T10:00:00.170Z'),
    );
    expect(link.url).toBe(
      'https://cv.example.test/cv-de-ejemplo.pdf?expires=1772359500',
    );
    expect(link.expiresAt.toISOString()).toBe('2026-03-01T10:05:00.170Z');
  });
});
