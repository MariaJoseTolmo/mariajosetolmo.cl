import type { Logger } from '../../../src/shared/application/ports/logger.port';

export class CapturingLogger implements Logger {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  warn(message: string): void {
    this.warnings.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}
