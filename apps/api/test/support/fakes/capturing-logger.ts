import type { Logger } from '../../../src/shared/application/ports/logger.port';

export class CapturingLogger implements Logger {
  readonly errors: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }
}
