import { FakeClock } from '../../../../test/support/fakes/fake-clock';
import { InMemoryMagicLinkStore } from './in-memory-magic-link.store';

describe('InMemoryMagicLinkStore', () => {
  const setup = (): { clock: FakeClock; store: InMemoryMagicLinkStore } => {
    const clock = new FakeClock();
    return { clock, store: new InMemoryMagicLinkStore(clock) };
  };

  it('returns the payload once, then null', async () => {
    const { store } = setup();
    await store.save('h1', { email: 'a@example.test', name: 'Ana' }, 900);
    await expect(store.consume('h1')).resolves.toEqual({
      email: 'a@example.test',
      name: 'Ana',
    });
    await expect(store.consume('h1')).resolves.toBeNull();
  });

  it('lets exactly one of two simultaneous consumers win', async () => {
    const { store } = setup();
    await store.save('h1', { email: 'a@example.test' }, 900);
    const results = await Promise.all([
      store.consume('h1'),
      store.consume('h1'),
    ]);
    expect(results.filter((payload) => payload !== null)).toEqual([
      { email: 'a@example.test' },
    ]);
  });

  it('expires the entry once the TTL has passed, and not before', async () => {
    const { clock, store } = setup();
    await store.save('h1', { email: 'a@example.test' }, 900);
    await store.save('h2', { email: 'b@example.test' }, 900);
    clock.advanceSeconds(899);
    await expect(store.consume('h1')).resolves.toEqual({
      email: 'a@example.test',
    });
    clock.advanceSeconds(1);
    await expect(store.consume('h2')).resolves.toBeNull();
  });

  it('exposes only hashes and ttls for inspection', async () => {
    const { store } = setup();
    await store.save('h1', { email: 'a@example.test' }, 900);
    expect(store.entries()).toEqual([
      { key: 'h1', ttlSeconds: 900, payload: { email: 'a@example.test' } },
    ]);
  });

  it('refuses to overwrite a live key, like SET NX', async () => {
    const { store } = setup();
    await store.save('h1', { email: 'a@example.test' }, 900);
    await expect(
      store.save('h1', { email: 'b@example.test' }, 900),
    ).rejects.toThrow('already exists');
  });
});
