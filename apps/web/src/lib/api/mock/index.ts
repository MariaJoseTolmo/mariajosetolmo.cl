import { MOCK_TOKEN } from '../mock-token';
import { isPlaygroundEndpoint } from '../playground-endpoints';
import type { ApiGateway } from '../port';
import type { ApiResult, RawResponse } from '../types';
import { failure, toApiFailure } from '../errors';
import {
  ERROR_KEY,
  type InjectedError,
  injectedBody,
  MOCK_BODIES,
  MOCK_CV_LINK,
  MOCK_FORBIDDEN_BODY,
  MOCK_ME,
  MOCK_STATUS_BY_CODE,
  SESSION_KEY,
  parseInjectedError,
} from './fixtures';

export { MOCK_MARKER } from './fixtures';

const OK: ApiResult<void> = { ok: true, data: undefined };
const hasSession = () => window.sessionStorage.getItem(SESSION_KEY) !== null;

/** Consumes the one-shot error key, if any; invalid values are dropped. */
function takeInjectedError(): InjectedError | undefined {
  const raw = window.sessionStorage.getItem(ERROR_KEY);
  if (raw === null) return undefined;
  window.sessionStorage.removeItem(ERROR_KEY);
  return parseInjectedError(raw);
}

// The failure goes through the same translator as the http adapter, so mock
// and real errors cannot drift.
const translate = ({ code, retryAfter }: InjectedError) =>
  toApiFailure({
    status: MOCK_STATUS_BY_CODE[code],
    body: injectedBody(code),
    retryAfter,
  });

/** Like the http adapter: 4xx/5xx (not 401) reach the playground as data. */
function playgroundResult(injected: InjectedError): ApiResult<RawResponse> {
  const failed = translate(injected);
  if (failed.status === 401) return failure('unauthorized', 401);
  const body = injectedBody(injected.code);
  return {
    ok: true,
    data: {
      status: body.statusCode,
      statusText: body.error,
      body,
      failure: failed,
    },
  };
}

/** Every method fails first if an injected error is pending. */
function withInjection(gateway: ApiGateway): ApiGateway {
  const injected = <T>(run: () => Promise<ApiResult<T>>) => {
    const pending = takeInjectedError();
    return pending
      ? Promise.resolve<ApiResult<T>>({ ok: false, ...translate(pending) })
      : run();
  };
  return {
    requestMagicLink: (req) => injected(() => gateway.requestMagicLink(req)),
    verifyToken: (token) => injected(() => gateway.verifyToken(token)),
    getMe: () => injected(() => gateway.getMe()),
    getCvLink: () => injected(() => gateway.getCvLink()),
    logout: () => injected(() => gateway.logout()),
    call(endpoint) {
      const pending = takeInjectedError();
      return pending
        ? Promise.resolve(playgroundResult(pending))
        : gateway.call(endpoint);
    },
  };
}

/** Deterministic adapter for development: no randomness, no timers. */
export function createMockGateway(): ApiGateway {
  return withInjection(createBaseGateway());
}

function createBaseGateway(): ApiGateway {
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
      if (!isPlaygroundEndpoint(endpoint)) {
        return Promise.resolve(failure('unexpected'));
      }
      if (!hasSession()) return Promise.resolve(failure('unauthorized'));
      if (endpoint === '/api/v1/admin/visits') {
        return Promise.resolve({
          ok: true,
          data: {
            status: 403,
            statusText: 'Forbidden',
            body: MOCK_FORBIDDEN_BODY,
            failure: toApiFailure({
              status: 403,
              body: MOCK_FORBIDDEN_BODY,
              retryAfter: null,
            }),
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
