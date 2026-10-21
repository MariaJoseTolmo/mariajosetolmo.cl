import type { ApiGateway } from './port';

let cached: Promise<ApiGateway> | undefined;

/**
 * The only entry point to the API. The mode is a build-time constant, so the
 * bundler drops the unused branch (and with it the mock adapter and its
 * marker) from `http` builds.
 */
export function loadGateway(): Promise<ApiGateway> {
  cached ??=
    process.env.NEXT_PUBLIC_API_MODE === 'mock'
      ? import('./mock').then((m) => m.createMockGateway())
      : import('./http').then((m) => m.createHttpGateway());
  return cached;
}
