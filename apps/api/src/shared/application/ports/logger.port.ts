/** What the application layer may say to an operator. Never pass secrets. */
export interface Logger {
  error(message: string): void;
}

export const LOGGER = Symbol('LOGGER');
