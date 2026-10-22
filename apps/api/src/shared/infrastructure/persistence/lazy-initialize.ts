import type { DataSource } from 'typeorm';

const pending = new WeakMap<DataSource, Promise<void>>();

/**
 * Opens the DataSource on first use instead of at boot, so the API starts (and
 * serves health and JWKS) while Postgres is down or cold; only the calls that
 * need the database fail (503). Simultaneous callers share one attempt, and a
 * failed attempt is forgotten so the next call tries again.
 */
export function ensureInitialized(dataSource: DataSource): Promise<void> {
  if (dataSource.isInitialized) return Promise.resolve();
  let attempt = pending.get(dataSource);
  if (!attempt) {
    attempt = dataSource.initialize().then(
      () => {
        pending.delete(dataSource);
      },
      (error: unknown) => {
        pending.delete(dataSource);
        throw error;
      },
    );
    pending.set(dataSource, attempt);
  }
  return attempt;
}
