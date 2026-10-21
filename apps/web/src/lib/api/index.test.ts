import { MOCK_TOKEN } from './mock-token';

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
const originalFetch = globalThis.fetch;

function stubFetch() {
  const spy = jest.fn(() =>
    Promise.resolve({
      status: 200,
      ok: true,
      statusText: 'OK',
      text: () => Promise.resolve(''),
    }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

/** Loads a fresh module so the cached gateway never leaks between tests. */
async function freshLoadGateway() {
  jest.resetModules();
  const { loadGateway } = await import('./index');
  return loadGateway;
}

afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
  globalThis.fetch = originalFetch;
  window.sessionStorage.clear();
});

describe('loadGateway', () => {
  it('selects the mock adapter when NEXT_PUBLIC_API_MODE=mock', async () => {
    const fetchSpy = stubFetch();
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const gateway = await (await freshLoadGateway())();
    // Only the mock accepts the mock token, and it never touches the network.
    expect(await gateway.verifyToken(MOCK_TOKEN)).toEqual({
      ok: true,
      data: undefined,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('selects the http adapter when NEXT_PUBLIC_API_MODE=http', async () => {
    const fetchSpy = stubFetch();
    process.env.NEXT_PUBLIC_API_MODE = 'http';
    const gateway = await (await freshLoadGateway())();
    await gateway.verifyToken(MOCK_TOKEN);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/verify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('defaults to http when the variable is not set', async () => {
    const fetchSpy = stubFetch();
    delete process.env.NEXT_PUBLIC_API_MODE;
    const gateway = await (await freshLoadGateway())();
    await gateway.logout();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches the gateway: every call resolves to the same instance', async () => {
    stubFetch();
    process.env.NEXT_PUBLIC_API_MODE = 'http';
    const loadGateway = await freshLoadGateway();
    const [first, second] = await Promise.all([loadGateway(), loadGateway()]);
    expect(second).toBe(first);
  });
});
