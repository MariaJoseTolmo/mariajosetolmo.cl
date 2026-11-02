import { Inject, Injectable } from '@nestjs/common';
import { describeFailure } from '../../shared/application/describe-failure';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../shared/application/ports/id-generator.port';
import {
  LOGGER,
  type Logger,
} from '../../shared/application/ports/logger.port';
import type { VisitKind } from '../domain/visit-kind';
import { retainFrom } from '../domain/visit-retention';
import type { VisitRecorder } from './ports/visit-recorder.port';
import {
  VISIT_REPOSITORY,
  type VisitRepository,
} from './ports/visit-repository.port';

/** Longest a caller waits for the record before it moves on without it. */
export const RECORD_TIMEOUT_MS = 1000;

/**
 * Best effort by design: whatever the store does, `record` resolves. The log
 * names the failure kind only (no user, email, IP, URL or cause), because a
 * deleted user with a live JWT also lands here as a foreign-key violation.
 */
@Injectable()
export class RecordVisit implements VisitRecorder {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly repository: VisitRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async record(input: { userId: string; kind: VisitKind }): Promise<void> {
    const now = this.clock.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), RECORD_TIMEOUT_MS);
    });
    try {
      // The append promise is created inside the try so a synchronous throw
      // is caught too; its late rejection after a timeout is absorbed below.
      const append = Promise.resolve().then(() =>
        this.repository.append(
          {
            id: this.ids.uuid(),
            userId: input.userId,
            kind: input.kind,
            occurredAt: now,
          },
          retainFrom(now),
        ),
      );
      append.catch(() => undefined);
      const outcome = await Promise.race([append, timeout]);
      if (outcome === 'timeout') this.logger.warn('visit recording timed out');
    } catch (error) {
      this.logger.error(`visit recording failed: ${describeFailure(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
