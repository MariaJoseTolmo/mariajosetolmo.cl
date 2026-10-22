import { Logger as NestCommonLogger } from '@nestjs/common';
import type { Logger } from '../application/ports/logger.port';

/** Operator-facing log line through Nest's logger. */
export class NestLogger implements Logger {
  private readonly logger = new NestCommonLogger('App');

  error(message: string): void {
    this.logger.error(message);
  }
}
