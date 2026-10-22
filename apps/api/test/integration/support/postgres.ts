import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../../../src/shared/infrastructure/persistence/data-source.factory';
import { databaseUrl } from './env';

export interface IsolatedDatabase {
  readonly schema: string;
  /** Initialised and pointed at a private schema (nothing runs in `public`). */
  readonly dataSource: DataSource;
  /** Runs a query on a plain connection to the same schema. */
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

/**
 * Every spec file works in its own schema, so it can run migrations, drop
 * tables and leave nothing behind even when the Postgres is the developer's.
 * The search_path is test-only (the app never relies on session state).
 */
export async function openIsolatedDatabase(): Promise<IsolatedDatabase> {
  const schema = `it_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: databaseUrl() });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const dataSource = createDataSource(databaseUrl(), {
    options: `-c search_path=${schema}`,
  });
  await dataSource.initialize();
  return {
    schema,
    dataSource,
    async query(sql, params = []) {
      const result = await dataSource.query<Record<string, unknown>[]>(
        sql,
        params,
      );
      return result;
    },
    async close() {
      await dataSource.destroy();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}
