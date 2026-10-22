import { DataSource } from 'typeorm';
import { MIGRATIONS } from './migrations';

export const DATA_SOURCE = Symbol('DATA_SOURCE');

// A serverless pooler (Neon) multiplexes connections: keep ours few and cheap.
const POOL_MAX = 2;
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Nothing here needs session state: no `SET`, no advisory locks, no
 * `synchronize`, no `migrationsRun` (migrations are a deliberate CLI step).
 * `extra` is merged into the `pg` pool options (tests use it for a private
 * schema; the application passes nothing).
 */
export function createDataSource(
  url: string,
  extra: Record<string, unknown> = {},
): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    migrations: MIGRATIONS,
    synchronize: false,
    migrationsRun: false,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
    extra: { max: POOL_MAX, ...extra },
  });
}
