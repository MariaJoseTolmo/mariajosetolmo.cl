import type { PlaygroundEndpoint } from './types';

/**
 * The only requests the recruiter playground may make: five fixed GETs.
 * Both adapters check this list at runtime, so a bad cast cannot turn the
 * playground into a generic request tool.
 */
export const PLAYGROUND_ENDPOINTS = [
  '/api/v1/profile',
  '/api/v1/experience?limit=2',
  '/api/v1/skills?level=advanced',
  '/api/v1/me',
  '/api/v1/admin/visits',
] as const satisfies readonly PlaygroundEndpoint[];

const ALLOWED: ReadonlySet<unknown> = new Set(PLAYGROUND_ENDPOINTS);

export function isPlaygroundEndpoint(
  value: unknown,
): value is PlaygroundEndpoint {
  return ALLOWED.has(value);
}
