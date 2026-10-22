import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  it('returns the current time as a fresh Date each call', () => {
    const before = Date.now();
    const first = new SystemClock().now();
    const after = Date.now();
    expect(first.getTime()).toBeGreaterThanOrEqual(before);
    expect(first.getTime()).toBeLessThanOrEqual(after);
    expect(new SystemClock().now()).not.toBe(first);
  });
});
