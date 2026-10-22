import { FakeClock } from '../../../test/support/fakes/fake-clock';
import { FakeCvLinkSigner } from '../../../test/support/fakes/fake-cv-link.signer';
import { InfrastructureUnavailable } from '../../shared/domain/errors';
import { GetCvLink } from './get-cv-link.use-case';
import type { CvLinkSigner } from './ports/cv-link-signer.port';

describe('GetCvLink', () => {
  it('returns the signer url and expiry as ISO 8601 UTC (clock + 300 s)', async () => {
    const clock = new FakeClock(new Date('2026-03-01T10:00:00.000Z'));
    const link = await new GetCvLink(
      new FakeCvLinkSigner(300),
      clock,
    ).execute();
    expect(link.url).toMatch(/^https:\/\/cv\.example\.test\//);
    expect(link.expiresAt).toBe('2026-03-01T10:05:00.000Z');
  });

  it('follows the clock and the signer lifetime (different inputs, different output)', async () => {
    const clock = new FakeClock(new Date('2026-07-15T23:59:30.000Z'));
    const link = await new GetCvLink(new FakeCvLinkSigner(60), clock).execute();
    expect(link.expiresAt).toBe('2026-07-16T00:00:30.000Z');
  });

  it('asks the signer on every call: a new link each time, none cached', async () => {
    const clock = new FakeClock();
    const signer = new FakeCvLinkSigner();
    const useCase = new GetCvLink(signer, clock);
    const first = await useCase.execute();
    clock.advanceSeconds(10);
    const second = await useCase.execute();
    expect(signer.calls).toBe(2);
    expect(second.url).not.toBe(first.url);
    expect(second.expiresAt).not.toBe(first.expiresAt);
  });

  it('hands the current instant to the signer', async () => {
    const seen: Date[] = [];
    const signer: CvLinkSigner = {
      sign: (now) => {
        seen.push(now);
        return Promise.resolve({
          url: 'https://x.example.test/a',
          expiresAt: now,
        });
      },
    };
    const clock = new FakeClock(new Date('2026-05-05T05:05:05.000Z'));
    await new GetCvLink(signer, clock).execute();
    expect(seen.map((d) => d.toISOString())).toEqual([
      '2026-05-05T05:05:05.000Z',
    ]);
  });

  it('lets a signer failure through (the filter turns it into 503)', async () => {
    const signer: CvLinkSigner = {
      sign: () => Promise.reject(new InfrastructureUnavailable()),
    };
    await expect(
      new GetCvLink(signer, new FakeClock()).execute(),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });
});
