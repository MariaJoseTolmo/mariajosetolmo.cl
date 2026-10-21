import { errorFromStatus, failure, type ErrorContext } from './errors';
import type { ApiGateway } from './port';
import { isPlaygroundEndpoint } from './playground-endpoints';
import type {
  ApiResult,
  CvLink,
  Me,
  PlaygroundEndpoint,
  RawResponse,
} from './types';

/** The slice of `Response` this adapter reads; keeps fakes trivial. */
export interface ResponseLike {
  status: number;
  ok: boolean;
  statusText: string;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<ResponseLike>;

const DEFAULT_TIMEOUT_MS = 15000;
const AUTH_PREFIX = '/api/auth/';
const REFRESH_PATH = '/api/auth/refresh';

type Method = 'GET' | 'POST';

/**
 * The single place that builds request options. Any origin-specific header
 * (Plan B: `x-amz-content-sha256`, computed with `crypto.subtle.digest`)
 * would be added here and nowhere else.
 */
function buildInit(
  method: Method,
  timeoutMs: number,
  body?: unknown,
): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    headers,
  };
  if (body === undefined) return init;
  headers['Content-Type'] = 'application/json';
  return { ...init, body: JSON.stringify(body) };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNullableString = (value: unknown) =>
  value === null || typeof value === 'string';

function isMe(value: unknown): value is Me {
  if (!isRecord(value) || !isRecord(value.availability)) return false;
  const { availability } = value;
  return (
    typeof value.email === 'string' &&
    (value.role === 'RECRUITER' || value.role === 'ADMIN') &&
    isNullableString(value.company) &&
    isNullableString(value.name) &&
    typeof availability.modality === 'string' &&
    typeof availability.start === 'string' &&
    typeof availability.salary === 'string'
  );
}

function isCvLink(value: unknown): value is CvLink {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

/** The parsed body, or an already-built failure when it cannot be read. */
type BodyOutcome = { body: unknown } | { failed: ApiResult<never> };

async function readBody(response: ResponseLike): Promise<BodyOutcome> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { failed: failure('network') };
  }
  if (text === '') return { body: null };
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { body: text };
  }
}

export interface HttpGatewayOptions {
  /** Aborts a request after this many ms; reported as `network`. */
  timeoutMs?: number;
}

/** Either a response, or an already-built failure (network, refresh). */
type Outcome = { response: ResponseLike } | { failed: ApiResult<never> };

export function createHttpGateway(
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  { timeoutMs = DEFAULT_TIMEOUT_MS }: HttpGatewayOptions = {},
): ApiGateway {
  let refreshing: Promise<ApiResult<void>> | undefined;

  async function send(
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<Outcome> {
    try {
      return {
        response: await fetchImpl(path, buildInit(method, timeoutMs, body)),
      };
    } catch {
      return { failed: failure('network') };
    }
  }

  async function performRefresh(): Promise<ApiResult<void>> {
    const outcome = await send('POST', REFRESH_PATH);
    if ('failed' in outcome) return outcome.failed;
    const { status, ok } = outcome.response;
    if (ok) return { ok: true, data: undefined };
    if (status === 429) return failure('rate-limited');
    return failure(status >= 500 ? 'server' : 'unauthorized');
  }

  /** One shared in-flight refresh; cleared once it settles. */
  function refreshOnce(): Promise<ApiResult<void>> {
    refreshing ??= performRefresh().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }

  /** On 401 (outside /api/auth/*): refresh once, then retry once. */
  async function request(
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<Outcome> {
    const first = await send(method, path, body);
    if (
      'failed' in first ||
      first.response.status !== 401 ||
      path.startsWith(AUTH_PREFIX)
    ) {
      return first;
    }
    const refreshed = await refreshOnce();
    if (!refreshed.ok) return { failed: refreshed };
    return send(method, path, body);
  }

  async function expectVoid(
    method: Method,
    path: string,
    body?: unknown,
    context?: ErrorContext,
  ): Promise<ApiResult<void>> {
    const outcome = await request(method, path, body);
    if ('failed' in outcome) return outcome.failed;
    const { response } = outcome;
    return response.ok
      ? { ok: true, data: undefined }
      : failure(errorFromStatus(response.status, context), response.status);
  }

  async function expectData<T>(
    path: string,
    isValid: (value: unknown) => value is T,
  ): Promise<ApiResult<T>> {
    const outcome = await request('GET', path);
    if ('failed' in outcome) return outcome.failed;
    const { response } = outcome;
    if (!response.ok) {
      return failure(errorFromStatus(response.status), response.status);
    }
    const read = await readBody(response);
    if ('failed' in read) return read.failed;
    return isValid(read.body)
      ? { ok: true, data: read.body }
      : failure('unexpected', response.status);
  }

  return {
    // Any 2xx counts as sent: the answer is identical whether or not the
    // email exists, so the body is never read.
    requestMagicLink: (req) => expectVoid('POST', '/api/auth/magic-link', req),
    verifyToken: (token) =>
      expectVoid('POST', '/api/auth/verify', { token }, 'verify'),
    getMe: () => expectData('/api/v1/me', isMe),
    getCvLink: () => expectData('/api/v1/cv', isCvLink),
    logout: () => expectVoid('POST', '/api/auth/logout'),
    async call(endpoint: PlaygroundEndpoint): Promise<ApiResult<RawResponse>> {
      if (!isPlaygroundEndpoint(endpoint)) return failure('unexpected');
      const outcome = await request('GET', endpoint);
      if ('failed' in outcome) return outcome.failed;
      const { response } = outcome;
      if (response.status === 401) return failure('unauthorized', 401);
      const read = await readBody(response);
      if ('failed' in read) return read.failed;
      return {
        ok: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          body: read.body,
        },
      };
    },
  };
}
