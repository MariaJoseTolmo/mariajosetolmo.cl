import { createHttpGateway, type ResponseLike } from './http';

interface Call {
  method: string;
  path: string;
  init: RequestInit;
}

const ME = {
  email: 'reclutadora@example.com',
  role: 'RECRUITER',
  company: null,
  name: null,
  availability: { modality: 'm', start: 's', salary: 'r' },
};

function res(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): ResponseLike {
  const text =
    body === undefined
      ? ''
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: `status ${status}`,
    text: () => Promise.resolve(text),
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  };
}

/** Fake `fetch` driven by a handler; records every call in order. */
function fakeFetch(
  handler: (call: Call, index: number) => ResponseLike | Error,
) {
  const calls: Call[] = [];
  const fetchImpl = (path: string, init: RequestInit) => {
    const call = { method: init.method ?? 'GET', path, init };
    calls.push(call);
    const out = handler(call, calls.length - 1);
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out);
  };
  return { fetchImpl, calls };
}

const summary = (calls: Call[]) => calls.map((c) => `${c.method} ${c.path}`);

describe('request shape', () => {
  it('uses relative /api paths, same-origin credentials and JSON bodies', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(202));
    await createHttpGateway(fetchImpl).requestMagicLink({
      email: 'a@example.com',
      company: 'Acme',
    });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.path).toBe('/api/auth/magic-link');
    expect(call?.init.method).toBe('POST');
    expect(call?.init.credentials).toBe('same-origin');
    expect(call?.init.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(call?.init.body as string)).toEqual({
      email: 'a@example.com',
      company: 'Acme',
    });
  });

  it('sends GET requests without a body or content type', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(200, ME));
    await createHttpGateway(fetchImpl).getMe();
    const [call] = calls;
    expect(call?.path).toBe('/api/v1/me');
    expect(call?.init.method).toBe('GET');
    expect(call?.init.credentials).toBe('same-origin');
    expect(call?.init.body).toBeUndefined();
    expect(call?.init.headers).not.toHaveProperty('Content-Type');
  });
});

describe('requestMagicLink', () => {
  it.each([200, 202, 204])('treats %i as sent', async (status) => {
    const { fetchImpl } = fakeFetch(() => res(status, { whatever: status }));
    expect(
      await createHttpGateway(fetchImpl).requestMagicLink({ email: 'a@b.cl' }),
    ).toEqual({ ok: true, data: undefined });
  });

  it('maps rate limiting, server errors and network failures', async () => {
    const gateway = (r: ResponseLike | Error) =>
      createHttpGateway(fakeFetch(() => r).fetchImpl);
    const req = { email: 'a@b.cl' };
    expect(await gateway(res(429)).requestMagicLink(req)).toEqual({
      ok: false,
      error: 'rate-limited',
      status: 429,
    });
    expect(await gateway(res(500)).requestMagicLink(req)).toEqual({
      ok: false,
      error: 'server',
      status: 500,
    });
    expect(
      await gateway(new TypeError('offline')).requestMagicLink(req),
    ).toEqual({ ok: false, error: 'network' });
  });
});

describe('verifyToken', () => {
  it('posts the token and succeeds on 2xx', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(200));
    expect(await createHttpGateway(fetchImpl).verifyToken('abc')).toEqual({
      ok: true,
      data: undefined,
    });
    expect(calls[0]?.path).toBe('/api/auth/verify');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ token: 'abc' });
  });

  it.each([400, 401, 410])(
    'maps %i to invalid-token without trying to refresh',
    async (status) => {
      const { fetchImpl, calls } = fakeFetch(() => res(status));
      const result = await createHttpGateway(fetchImpl).verifyToken('abc');
      expect(result).toEqual({ ok: false, error: 'invalid-token', status });
      expect(calls).toHaveLength(1);
    },
  );

  it('maps 429 and network failures', async () => {
    expect(
      await createHttpGateway(fakeFetch(() => res(429)).fetchImpl).verifyToken(
        'abc',
      ),
    ).toMatchObject({ ok: false, error: 'rate-limited' });
    expect(
      await createHttpGateway(
        fakeFetch(() => new TypeError('offline')).fetchImpl,
      ).verifyToken('abc'),
    ).toEqual({ ok: false, error: 'network' });
  });
});

describe('getMe', () => {
  it('returns the profile on 200', async () => {
    const { fetchImpl } = fakeFetch(() => res(200, ME));
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: true,
      data: ME,
    });
  });

  it.each([
    ['not json', 'oops'],
    ['an empty body', undefined],
    ['a profile without availability', { ...ME, availability: undefined }],
    ['an unknown role', { ...ME, role: 'GUEST' }],
  ])('rejects %s as unexpected', async (_label, body) => {
    const { fetchImpl } = fakeFetch(() => res(200, body));
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: false,
      error: 'unexpected',
      status: 200,
    });
  });

  it('maps 5xx to server and a thrown fetch to network', async () => {
    expect(
      await createHttpGateway(fakeFetch(() => res(503)).fetchImpl).getMe(),
    ).toEqual({ ok: false, error: 'server', status: 503 });
    expect(
      await createHttpGateway(
        fakeFetch(() => new TypeError('offline')).fetchImpl,
      ).getMe(),
    ).toEqual({ ok: false, error: 'network' });
  });
});

describe('session refresh', () => {
  it('refreshes exactly once and then reports unauthorized', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(200) : res(401),
    );
    const result = await createHttpGateway(fetchImpl).getMe();
    expect(result).toEqual({ ok: false, error: 'unauthorized', status: 401 });
    expect(summary(calls)).toEqual([
      'GET /api/v1/me',
      'POST /api/auth/refresh',
      'GET /api/v1/me',
    ]);
  });

  it('recovers the session when the retry succeeds', async () => {
    const { fetchImpl, calls } = fakeFetch((call, index) => {
      if (call.path === '/api/auth/refresh') return res(200);
      return index === 0 ? res(401) : res(200, ME);
    });
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: true,
      data: ME,
    });
    expect(calls).toHaveLength(3);
  });

  it('shares one in-flight refresh between concurrent calls', async () => {
    let release: (value: ResponseLike) => void = () => undefined;
    const refreshGate = new Promise<ResponseLike>((resolve) => {
      release = resolve;
    });
    const calls: Call[] = [];
    let meCalls = 0;
    const fetchImpl = (path: string, init: RequestInit) => {
      calls.push({ method: init.method ?? 'GET', path, init });
      if (path === '/api/auth/refresh') return refreshGate;
      meCalls += 1;
      return Promise.resolve(meCalls <= 2 ? res(401) : res(200, ME));
    };
    const gateway = createHttpGateway(fetchImpl);

    const both = Promise.all([gateway.getMe(), gateway.getMe()]);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release(res(200));
    const [a, b] = await both;

    expect(a).toEqual({ ok: true, data: ME });
    expect(b).toEqual({ ok: true, data: ME });
    expect(calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1);
  });

  it('starts a new refresh for a later 401 once the previous one settled', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(200) : res(401),
    );
    const gateway = createHttpGateway(fetchImpl);
    await gateway.getMe();
    await gateway.getMe();
    expect(calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(2);
  });

  it('reports unauthorized without retrying when the refresh is rejected', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(401) : res(401),
    );
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    expect(summary(calls)).toEqual([
      'GET /api/v1/me',
      'POST /api/auth/refresh',
    ]);
  });

  it('keeps a network failure during refresh distinct from unauthorized', async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? new TypeError('offline') : res(401),
    );
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('reports a server error during refresh as server', async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(502) : res(401),
    );
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: false,
      error: 'server',
      status: 502,
    });
  });

  it('never refreshes for the auth endpoints themselves', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(401));
    await createHttpGateway(fetchImpl).logout();
    expect(summary(calls)).toEqual(['POST /api/auth/logout']);
  });
});

describe('getCvLink and logout', () => {
  it('returns the signed link', async () => {
    const link = { url: 'https://example.invalid/x', expiresAt: 'later' };
    const { fetchImpl, calls } = fakeFetch(() => res(200, link));
    expect(await createHttpGateway(fetchImpl).getCvLink()).toEqual({
      ok: true,
      data: link,
    });
    expect(calls[0]?.path).toBe('/api/v1/cv');
  });

  it('rejects a malformed link and maps 403', async () => {
    expect(
      await createHttpGateway(
        fakeFetch(() => res(200, { url: 3 })).fetchImpl,
      ).getCvLink(),
    ).toMatchObject({ ok: false, error: 'unexpected' });
    expect(
      await createHttpGateway(fakeFetch(() => res(403)).fetchImpl).getCvLink(),
    ).toEqual({ ok: false, error: 'forbidden', status: 403 });
  });

  it('logs out with a POST and treats 2xx as done', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(204));
    expect(await createHttpGateway(fetchImpl).logout()).toEqual({
      ok: true,
      data: undefined,
    });
    expect(summary(calls)).toEqual(['POST /api/auth/logout']);
  });
});

describe('call', () => {
  it('returns any HTTP response as data, 403 included', async () => {
    const { fetchImpl } = fakeFetch(() =>
      res(403, { statusCode: 403, message: 'Forbidden' }),
    );
    expect(
      await createHttpGateway(fetchImpl).call('/api/v1/admin/visits'),
    ).toEqual({
      ok: true,
      data: {
        status: 403,
        statusText: 'status 403',
        body: { statusCode: 403, message: 'Forbidden' },
        failure: { error: 'forbidden', status: 403 },
      },
    });
  });

  it('keeps non-JSON bodies as text and empty bodies as null', async () => {
    expect(
      await createHttpGateway(
        fakeFetch(() => res(404, '<html>nope</html>')).fetchImpl,
      ).call('/api/v1/profile'),
    ).toMatchObject({ ok: true, data: { body: '<html>nope</html>' } });
    expect(
      await createHttpGateway(fakeFetch(() => res(200)).fetchImpl).call(
        '/api/v1/profile',
      ),
    ).toMatchObject({ ok: true, data: { status: 200, body: null } });
  });

  it('requests the exact endpoint and refreshes once on 401', async () => {
    const { fetchImpl, calls } = fakeFetch((call, index) => {
      if (call.path === '/api/auth/refresh') return res(200);
      return index === 0 ? res(401) : res(200, { ok: 1 });
    });
    const result = await createHttpGateway(fetchImpl).call(
      '/api/v1/skills?level=advanced',
    );
    expect(result).toMatchObject({ ok: true, data: { status: 200 } });
    expect(summary(calls)).toEqual([
      'GET /api/v1/skills?level=advanced',
      'POST /api/auth/refresh',
      'GET /api/v1/skills?level=advanced',
    ]);
  });

  it('reports unauthorized when the retry is still 401', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(200) : res(401),
    );
    expect(await createHttpGateway(fetchImpl).call('/api/v1/me')).toEqual({
      ok: false,
      error: 'unauthorized',
      status: 401,
    });
    expect(calls).toHaveLength(3);
  });

  it('reports a network failure as an error, not as a response', async () => {
    const { fetchImpl } = fakeFetch(() => new TypeError('offline'));
    expect(await createHttpGateway(fetchImpl).call('/api/v1/me')).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('reports unauthorized when the refresh did not help', async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(401) : res(401),
    );
    expect(await createHttpGateway(fetchImpl).call('/api/v1/me')).toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });
});

describe('default fetch', () => {
  it('uses the global fetch when none is injected', async () => {
    const original = globalThis.fetch;
    const spy = jest.fn(() => Promise.resolve(res(200, ME)));
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      await createHttpGateway().getMe();
      expect(spy).toHaveBeenCalledWith(
        '/api/v1/me',
        expect.objectContaining({ credentials: 'same-origin' }),
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('body read failures', () => {
  const broken = (status: number): ResponseLike => ({
    status,
    ok: status >= 200 && status < 300,
    statusText: `status ${status}`,
    text: () => Promise.reject(new TypeError('body stream failed')),
    headers: { get: () => null },
  });

  it('resolves network when the body of a data call cannot be read', async () => {
    const gateway = createHttpGateway(fakeFetch(() => broken(200)).fetchImpl);
    expect(await gateway.getMe()).toEqual({ ok: false, error: 'network' });
    expect(await gateway.getCvLink()).toEqual({ ok: false, error: 'network' });
  });

  it('resolves network when the body of a playground call cannot be read', async () => {
    const gateway = createHttpGateway(fakeFetch(() => broken(200)).fetchImpl);
    expect(await gateway.call('/api/v1/me')).toEqual({
      ok: false,
      error: 'network',
    });
  });
});

describe('timeout', () => {
  /** A fetch that never answers on its own and rejects once aborted. */
  const hanging = (path: string, init: RequestInit) =>
    new Promise<ResponseLike>((_resolve, reject) => {
      void path;
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    });

  it('attaches an abort signal to every request', async () => {
    const { fetchImpl, calls } = fakeFetch(() => res(200, ME));
    await createHttpGateway(fetchImpl).getMe();
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports network when a request exceeds the timeout', async () => {
    const gateway = createHttpGateway(hanging, { timeoutMs: 10 });
    expect(await gateway.requestMagicLink({ email: 'a@b.cl' })).toEqual({
      ok: false,
      error: 'network',
    });
    expect(await gateway.getMe()).toEqual({ ok: false, error: 'network' });
  });

  it('defaults to a 15 second timeout', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    try {
      await createHttpGateway(fakeFetch(() => res(200, ME)).fetchImpl).getMe();
      expect(spy).toHaveBeenCalledWith(15000);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('caching and refresh throttling', () => {
  it('never lets the browser cache any request', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' || call.method === 'POST'
        ? res(200)
        : res(200, ME),
    );
    const gateway = createHttpGateway(fetchImpl);
    await gateway.getMe();
    await gateway.call('/api/v1/me');
    await gateway.logout();
    await gateway.requestMagicLink({ email: 'a@b.cl' });
    expect(calls).toHaveLength(4);
    for (const call of calls) expect(call.init.cache).toBe('no-store');
  });

  it('reports rate-limited when the refresh itself is throttled', async () => {
    const { fetchImpl } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(429) : res(401),
    );
    expect(await createHttpGateway(fetchImpl).getMe()).toEqual({
      ok: false,
      error: 'rate-limited',
      status: 429,
    });
  });
});

const FORBIDDEN_BODY = (code: string) => ({
  statusCode: 403,
  error: 'Forbidden',
  message: 'fixed message',
  code,
});

describe('error translation', () => {
  const gateway = (r: ResponseLike | Error) =>
    createHttpGateway(fakeFetch(() => r).fetchImpl);

  it('keeps the reason of a 403 ORIGIN_NOT_ALLOWED', async () => {
    const result = await gateway(
      res(403, FORBIDDEN_BODY('ORIGIN_NOT_ALLOWED')),
    ).requestMagicLink({ email: 'a@b.cl' });
    expect(result).toEqual({
      ok: false,
      error: 'forbidden',
      status: 403,
      reason: 'ORIGIN_NOT_ALLOWED',
    });
  });

  it('exposes Retry-After on a 429', async () => {
    const result = await gateway(
      res(429, { code: 'RATE_LIMITED' }, { 'retry-after': '120' }),
    ).requestMagicLink({ email: 'a@b.cl' });
    expect(result).toEqual({
      ok: false,
      error: 'rate-limited',
      status: 429,
      reason: 'RATE_LIMITED',
      retryAfterSeconds: 120,
    });
  });

  it('keeps the reason of a 503', async () => {
    expect(
      await gateway(res(503, { code: 'SERVICE_UNAVAILABLE' })).getMe(),
    ).toEqual({
      ok: false,
      error: 'server',
      status: 503,
      reason: 'SERVICE_UNAVAILABLE',
    });
  });

  it('reports an unreadable error body as server, not network', async () => {
    const unreadable: ResponseLike = {
      ...res(500),
      text: () => Promise.reject(new TypeError('stream failed')),
    };
    expect(await gateway(unreadable).getMe()).toEqual({
      ok: false,
      error: 'server',
      status: 500,
    });
  });

  it('reports a rejected fetch as network without a status', async () => {
    expect(await gateway(new TypeError('offline')).getMe()).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('falls back to the status for an API that sends no code', async () => {
    expect(await gateway(res(403, 'plain html')).getCvLink()).toEqual({
      ok: false,
      error: 'forbidden',
      status: 403,
    });
  });

  it('uses the code in the verify context', async () => {
    expect(
      await gateway(res(400, { code: 'INVALID_TOKEN' })).verifyToken('abc'),
    ).toEqual({
      ok: false,
      error: 'invalid-token',
      status: 400,
      reason: 'INVALID_TOKEN',
    });
  });

  it('never reads the 2xx body of a magic-link request', async () => {
    const text = jest.fn(() => Promise.reject(new Error('must not read')));
    const response: ResponseLike = { ...res(202), text };
    await gateway(response).requestMagicLink({ email: 'a@b.cl' });
    expect(text).not.toHaveBeenCalled();
  });

  it('attaches the failure to a playground 4xx/5xx response', async () => {
    const body = FORBIDDEN_BODY('ROLE_NOT_ALLOWED');
    expect(await gateway(res(403, body)).call('/api/v1/admin/visits')).toEqual({
      ok: true,
      data: {
        status: 403,
        statusText: 'status 403',
        body,
        failure: {
          error: 'forbidden',
          status: 403,
          reason: 'ROLE_NOT_ALLOWED',
        },
      },
    });
  });
});

describe('refresh failures (A11)', () => {
  const meWithRefresh = (refresh: ResponseLike) =>
    createHttpGateway(
      fakeFetch((call) =>
        call.path === '/api/auth/refresh' ? refresh : res(401),
      ).fetchImpl,
    ).getMe();

  it('treats a 400 refresh as unauthorized', async () => {
    expect(await meWithRefresh(res(400))).toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });

  it('keeps a blocked refresh as forbidden with its reason', async () => {
    expect(
      await meWithRefresh(res(403, FORBIDDEN_BODY('CDN_REQUIRED'))),
    ).toEqual({
      ok: false,
      error: 'forbidden',
      status: 403,
      reason: 'CDN_REQUIRED',
    });
  });

  it('keeps Retry-After from a throttled refresh', async () => {
    expect(
      await meWithRefresh(res(429, null, { 'retry-after': '30' })),
    ).toEqual({
      ok: false,
      error: 'rate-limited',
      status: 429,
      retryAfterSeconds: 30,
    });
  });

  it('runs one refresh and two reads when the retry is 401 again', async () => {
    const { fetchImpl, calls } = fakeFetch((call) =>
      call.path === '/api/auth/refresh' ? res(200) : res(401),
    );
    const result = await createHttpGateway(fetchImpl).getMe();
    expect(result).toMatchObject({ ok: false, error: 'unauthorized' });
    expect(summary(calls)).toEqual([
      'GET /api/v1/me',
      'POST /api/auth/refresh',
      'GET /api/v1/me',
    ]);
  });
});
