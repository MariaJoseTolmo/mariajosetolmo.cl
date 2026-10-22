// Defaults match .env.example and the CI service containers. Locally, export
// REDIS_URL and DATABASE_URL when docker-compose uses other host ports.
export function redisUrl(): string {
  return process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
}

export function databaseUrl(): string {
  return (
    process.env['DATABASE_URL'] ??
    'postgres://webcv:local-dev-only@127.0.0.1:5432/webcv'
  );
}
