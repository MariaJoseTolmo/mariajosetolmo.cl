import type { DataSource } from 'typeorm';
import { ensureInitialized } from './lazy-initialize';

interface FakeSource {
  isInitialized: boolean;
  calls: number;
  failures: number;
  initialize(): Promise<unknown>;
}

function fakeSource(failures = 0): FakeSource {
  const source: FakeSource = {
    isInitialized: false,
    calls: 0,
    failures,
    initialize() {
      source.calls += 1;
      if (source.failures > 0) {
        source.failures -= 1;
        return Promise.reject(new Error('connect ECONNREFUSED'));
      }
      source.isInitialized = true;
      return Promise.resolve(source);
    },
  };
  return source;
}
const asDs = (source: FakeSource): DataSource =>
  source as unknown as DataSource;

describe('ensureInitialized', () => {
  it('initialises an unopened source on first use', async () => {
    const source = fakeSource();
    await ensureInitialized(asDs(source));
    expect(source.isInitialized).toBe(true);
    expect(source.calls).toBe(1);
  });

  it('does nothing for a source that is already open', async () => {
    const source = fakeSource();
    source.isInitialized = true;
    await ensureInitialized(asDs(source));
    expect(source.calls).toBe(0);
  });

  it('shares one attempt between simultaneous callers', async () => {
    const source = fakeSource();
    await Promise.all([
      ensureInitialized(asDs(source)),
      ensureInitialized(asDs(source)),
      ensureInitialized(asDs(source)),
    ]);
    expect(source.calls).toBe(1);
  });

  it('rejects when the database is down, and retries on the next call', async () => {
    const source = fakeSource(1);
    await expect(ensureInitialized(asDs(source))).rejects.toThrow(
      'ECONNREFUSED',
    );
    expect(source.isInitialized).toBe(false);
    await ensureInitialized(asDs(source));
    expect(source.isInitialized).toBe(true);
    expect(source.calls).toBe(2);
  });

  it('keeps failing while the database stays down, one attempt per call', async () => {
    const source = fakeSource(2);
    await expect(ensureInitialized(asDs(source))).rejects.toThrow();
    await expect(ensureInitialized(asDs(source))).rejects.toThrow();
    expect(source.calls).toBe(2);
  });
});
