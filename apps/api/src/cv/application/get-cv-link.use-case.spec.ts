import { FakeClock } from '../../../test/support/fakes/fake-clock';
import { FakeCvLinkSigner } from '../../../test/support/fakes/fake-cv-link.signer';
import { InfrastructureUnavailable } from '../../shared/domain/errors';
import type { VisitRecorder } from '../../visits/application/ports/visit-recorder.port';
import type { VisitKind } from '../../visits/domain/visit-kind';
import { GetCvLink } from './get-cv-link.use-case';
import type { CvLinkSigner } from './ports/cv-link-signer.port';

const PRINCIPAL = { userId: 'user-1' };

class FakeRecorder implements VisitRecorder {
  readonly calls: { userId: string; kind: VisitKind }[] = [];
  record(input: { userId: string; kind: VisitKind }): Promise<void> {
    this.calls.push(input);
    return Promise.resolve();
  }
}

describe('GetCvLink', () => {
  it('returns the signer url and expiry as ISO 8601 UTC (clock + 300 s)', async () => {
    const clock = new FakeClock(new Date('2026-03-01T10:00:00.000Z'));
    const link = await new GetCvLink(
      new FakeCvLinkSigner(300),
      clock,
      new FakeRecorder(),
    ).execute(PRINCIPAL);
    expect(link.url).toMatch(/^https:\/\/cv\.example\.test\//);
    expect(link.expiresAt).toBe('2026-03-01T10:05:00.000Z');
  });

  it('follows the clock and the signer lifetime (different inputs, different output)', async () => {
    const clock = new FakeClock(new Date('2026-07-15T23:59:30.000Z'));
    const link = await new GetCvLink(
      new FakeCvLinkSigner(60),
      clock,
      new FakeRecorder(),
    ).execute(PRINCIPAL);
    expect(link.expiresAt).toBe('2026-07-16T00:00:30.000Z');
  });

  it('asks the signer on every call: a new link each time, none cached', async () => {
    const clock = new FakeClock();
    const signer = new FakeCvLinkSigner();
    const useCase = new GetCvLink(signer, clock, new FakeRecorder());
    const first = await useCase.execute(PRINCIPAL);
    clock.advanceSeconds(10);
    const second = await useCase.execute(PRINCIPAL);
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
    await new GetCvLink(signer, clock, new FakeRecorder()).execute(PRINCIPAL);
    expect(seen.map((d) => d.toISOString())).toEqual([
      '2026-05-05T05:05:05.000Z',
    ]);
  });

  it('lets a signer failure through (the filter turns it into 503)', async () => {
    const signer: CvLinkSigner = {
      sign: () => Promise.reject(new InfrastructureUnavailable()),
    };
    await expect(
      new GetCvLink(signer, new FakeClock(), new FakeRecorder()).execute(
        PRINCIPAL,
      ),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });

  describe('visit recording', () => {
    it('records one CV_LINK for the principal, after the link is signed', async () => {
      const order: string[] = [];
      const signer: CvLinkSigner = {
        sign: (now) => {
          order.push('sign');
          return Promise.resolve({
            url: 'https://x.example.test/a',
            expiresAt: now,
          });
        },
      };
      const recorder: VisitRecorder = {
        record: (input) => {
          order.push(`record:${input.userId}:${input.kind}`);
          return Promise.resolve();
        },
      };
      await new GetCvLink(signer, new FakeClock(), recorder).execute({
        userId: 'user-9',
      });
      expect(order).toEqual(['sign', 'record:user-9:CV_LINK']);
    });

    it('records once per call', async () => {
      const recorder = new FakeRecorder();
      const useCase = new GetCvLink(
        new FakeCvLinkSigner(),
        new FakeClock(),
        recorder,
      );
      await useCase.execute(PRINCIPAL);
      await useCase.execute(PRINCIPAL);
      expect(recorder.calls).toEqual([
        { userId: 'user-1', kind: 'CV_LINK' },
        { userId: 'user-1', kind: 'CV_LINK' },
      ]);
    });

    it('never records when the signer fails', async () => {
      const recorder = new FakeRecorder();
      const signer: CvLinkSigner = {
        sign: () => Promise.reject(new InfrastructureUnavailable()),
      };
      await expect(
        new GetCvLink(signer, new FakeClock(), recorder).execute(PRINCIPAL),
      ).rejects.toBeInstanceOf(InfrastructureUnavailable);
      expect(recorder.calls).toEqual([]);
    });

    it('returns the link without the user id or any visit data', async () => {
      const link = await new GetCvLink(
        new FakeCvLinkSigner(),
        new FakeClock(),
        new FakeRecorder(),
      ).execute(PRINCIPAL);
      expect(Object.keys(link).sort()).toEqual(['expiresAt', 'url']);
    });
  });
});
