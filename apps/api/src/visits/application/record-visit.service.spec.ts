import { FakeClock } from '../../../test/support/fakes/fake-clock';
import { CapturingLogger } from '../../../test/support/fakes/capturing-logger';
import { SequenceIdGenerator } from '../../../test/support/fakes/sequence-id-generator';
import type { VisitEvent } from '../domain/visit-event';
import { retainFrom } from '../domain/visit-retention';
import type { VisitRepository } from './ports/visit-repository.port';
import { RecordVisit } from './record-visit.service';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const USER_ID = '7f0c2b1e-0000-4000-8000-000000000001';

interface Call {
  event: VisitEvent;
  retainFrom: Date;
}

function setup(repository?: Partial<VisitRepository>): {
  service: RecordVisit;
  calls: Call[];
  logger: CapturingLogger;
} {
  const calls: Call[] = [];
  const logger = new CapturingLogger();
  const repo: VisitRepository = {
    append: (event, from) => {
      calls.push({ event, retainFrom: from });
      return Promise.resolve();
    },
    listPage: () => Promise.resolve([]),
    ...repository,
  };
  const service = new RecordVisit(
    repo,
    new SequenceIdGenerator(),
    new FakeClock(NOW),
    logger,
  );
  return { service, calls, logger };
}

describe('RecordVisit', () => {
  it.each(['LOGIN', 'CV_LINK'] as const)(
    'appends a %s event with a generated id, the clock instant and the retention cut',
    async (kind) => {
      const { service, calls } = setup();
      await service.record({ userId: USER_ID, kind });
      expect(calls).toEqual([
        {
          event: { id: 'id-1', userId: USER_ID, kind, occurredAt: NOW },
          retainFrom: retainFrom(NOW),
        },
      ]);
    },
  );

  it('uses a new id for every event', async () => {
    const { service, calls } = setup();
    await service.record({ userId: USER_ID, kind: 'LOGIN' });
    await service.record({ userId: USER_ID, kind: 'LOGIN' });
    expect(calls.map((c) => c.event.id)).toEqual(['id-1', 'id-2']);
  });

  it('resolves when the repository throws, and logs only the failure kind', async () => {
    const failure = Object.assign(
      new Error(`insert failed for ${USER_ID} recruiter@example.test`),
      { code: '23503' },
    );
    const { service, logger } = setup({
      append: () => Promise.reject(failure),
    });
    await expect(
      service.record({ userId: USER_ID, kind: 'LOGIN' }),
    ).resolves.toBeUndefined();
    expect(logger.errors).toEqual(['visit recording failed: Error 23503']);
    const logged = JSON.stringify([logger.errors, logger.warnings]);
    expect(logged).not.toContain(USER_ID);
    expect(logged).not.toContain('example.test');
  });

  describe('time cap', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('resolves after 1000 ms with a warning when the repository never answers', async () => {
      const { service, logger } = setup({
        append: () => new Promise<void>(() => undefined),
      });
      let done = false;
      const pending = service
        .record({ userId: USER_ID, kind: 'CV_LINK' })
        .then(() => {
          done = true;
        });
      await jest.advanceTimersByTimeAsync(999);
      expect(done).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await pending;
      expect(done).toBe(true);
      expect(logger.warnings).toEqual(['visit recording timed out']);
      expect(logger.errors).toEqual([]);
    });

    it('clears the timer when the repository answers first', async () => {
      const { service, logger } = setup();
      await service.record({ userId: USER_ID, kind: 'LOGIN' });
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(5000);
      expect(logger.warnings).toEqual([]);
    });

    it('absorbs a rejection that arrives after the timeout', async () => {
      const { service, logger } = setup({
        append: () =>
          new Promise<void>((_resolve, reject) => {
            setTimeout(() => reject(new Error('late')), 2000);
          }),
      });
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);
      try {
        const pending = service.record({ userId: USER_ID, kind: 'LOGIN' });
        await jest.advanceTimersByTimeAsync(1000);
        await pending;
        expect(logger.warnings).toEqual(['visit recording timed out']);
        await jest.advanceTimersByTimeAsync(1000);
        jest.useRealTimers();
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(logger.errors).toEqual([]);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    });

    it('clears the timer when the repository fails first', async () => {
      const { service } = setup({
        append: () => Promise.reject(new Error('x')),
      });
      await service.record({ userId: USER_ID, kind: 'LOGIN' });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
