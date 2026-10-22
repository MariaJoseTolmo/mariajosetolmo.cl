import { createDataSource } from './data-source.factory';

// Used only by the TypeORM CLI (`npm run migration:run|revert -w apps/api`),
// from the compiled output: no ts-node. A direct connection URL, not the
// pooled one: migrations run in a transaction and must not share a pooler.
const url = process.env['MIGRATIONS_DATABASE_URL'];
if (!url) throw new Error('Missing MIGRATIONS_DATABASE_URL');

export default createDataSource(url);
