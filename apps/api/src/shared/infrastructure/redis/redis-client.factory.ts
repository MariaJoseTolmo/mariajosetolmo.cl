import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const CONNECT_TIMEOUT_MS = 2000;
// How long a closing socket may linger before it is destroyed (library default
// 2000): keeps shutdown, and the test runner, from waiting on a dead socket.
const DISCONNECT_TIMEOUT_MS = 200;

/**
 * Lazy: nothing connects until the first command, so the API boots without
 * Redis and every use fails closed (503) instead. The offline queue stays on
 * on purpose: with `lazyConnect`, disabling it makes the very first command
 * fail ("Stream isn't writeable"). `maxRetriesPerRequest: 1` bounds the wait
 * when Redis is down. `rediss://` URLs switch TLS on (Upstash).
 */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: CONNECT_TIMEOUT_MS,
    disconnectTimeout: DISCONNECT_TIMEOUT_MS,
  });
}
