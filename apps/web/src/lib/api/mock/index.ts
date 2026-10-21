import { MOCK_TOKEN } from '../mock-token';
import type { ApiGateway } from '../port';
import type { ApiResult } from '../types';
import { failure } from '../errors';
import {
  MOCK_BODIES,
  MOCK_CV_LINK,
  MOCK_FORBIDDEN_BODY,
  MOCK_ME,
  SESSION_KEY,
} from './fixtures';

export { MOCK_MARKER } from './fixtures';

const OK: ApiResult<void> = { ok: true, data: undefined };
const hasSession = () => window.sessionStorage.getItem(SESSION_KEY) !== null;

/** Deterministic adapter for development: no randomness, no timers. */
export function createMockGateway(): ApiGateway {
  return {
    requestMagicLink: () => Promise.resolve(OK),
    verifyToken(token) {
      if (token !== MOCK_TOKEN)
        return Promise.resolve(failure('invalid-token'));
      window.sessionStorage.setItem(SESSION_KEY, '1');
      return Promise.resolve(OK);
    },
    getMe: () =>
      Promise.resolve(
        hasSession() ? { ok: true, data: MOCK_ME } : failure('unauthorized'),
      ),
    getCvLink: () =>
      Promise.resolve(
        hasSession()
          ? { ok: true, data: MOCK_CV_LINK }
          : failure('unauthorized'),
      ),
    logout() {
      window.sessionStorage.removeItem(SESSION_KEY);
      return Promise.resolve(OK);
    },
    call(endpoint) {
      if (!hasSession()) return Promise.resolve(failure('unauthorized'));
      if (endpoint === '/api/v1/admin/visits') {
        return Promise.resolve({
          ok: true,
          data: {
            status: 403,
            statusText: 'Forbidden',
            body: MOCK_FORBIDDEN_BODY,
          },
        });
      }
      return Promise.resolve({
        ok: true,
        data: { status: 200, statusText: 'OK', body: MOCK_BODIES[endpoint] },
      });
    },
  };
}
