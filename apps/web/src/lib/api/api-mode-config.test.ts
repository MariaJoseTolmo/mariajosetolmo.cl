const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;

async function loadConfig() {
  jest.resetModules();
  return (await import('../../../next.config')).default;
}

afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
});

// Next only inlines NEXT_PUBLIC_* values it knows about at build time, so the
// resolved mode must be handed back through `env`. Without it, an unset
// variable stays a runtime lookup and the mock adapter is never dropped.
describe('NEXT_PUBLIC_API_MODE in next.config', () => {
  it('pins the default to http so the mock branch is eliminated', async () => {
    delete process.env.NEXT_PUBLIC_API_MODE;
    expect((await loadConfig()).env).toEqual({ NEXT_PUBLIC_API_MODE: 'http' });
  });

  it.each(['http', 'mock'])('keeps an explicit %s', async (mode) => {
    process.env.NEXT_PUBLIC_API_MODE = mode;
    expect((await loadConfig()).env).toEqual({ NEXT_PUBLIC_API_MODE: mode });
  });

  it('rejects any other value at build time', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'staging';
    await expect(loadConfig()).rejects.toThrow(
      'Invalid NEXT_PUBLIC_API_MODE: staging',
    );
  });
});
