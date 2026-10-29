import { failure, toApiFailure, type ErrorContext } from './errors';
import type { ApiGateway } from './port';
import { isPlaygroundEndpoint } from './playground-endpoints';
import type {
  ApiFailure,
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
  headers: { get(name: string): string | null };
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

/** Error bodies are best effort: an unreadable one becomes `null`, not `network`. */
async function readErrorBody(response: ResponseLike): Promise<unknown> {
  const read = await readBody(response);
  return 'failed' in read ? null : read.body;
}

async function failureOf(
  response: ResponseLike,
  context?: ErrorContext,
): Promise<ApiFailure> {
  return toApiFailure(
    {
      status: response.status,
      body: await readErrorBody(response),
      retryAfter: response.headers.get('Retry-After'),
    },
    context,
  );
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
    const { response } = outcome;
    if (response.ok) return { ok: true, data: undefined };
    // A rejected session (400/401) is the only refresh failure that logs out.
    if (response.status === 400 || response.status === 401) {
      return failure('unauthorized');
    }
    return { ok: false, ...(await failureOf(response)) };
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
      : { ok: false, ...(await failureOf(response, context)) };
  }

  async function expectData<T>(
    path: string,
    isValid: (value: unknown) => value is T,
  ): Promise<ApiResult<T>> {
    const outcome = await request('GET', path);
    if ('failed' in outcome) return outcome.failed;
    const { response } = outcome;
    if (!response.ok) return { ok: false, ...(await failureOf(response)) };
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
      const isError = response.status >= 400;
      const read = isError
        ? { body: await readErrorBody(response) }
        : await readBody(response);
      if ('failed' in read) return read.failed;
      const data: RawResponse = {
        status: response.status,
        statusText: response.statusText,
        body: read.body,
      };
      if (isError) {
        data.failure = toApiFailure({
          status: response.status,
          body: read.body,
          retryAfter: response.headers.get('Retry-After'),
        });
      }
      return { ok: true, data };
    },
  };
}
