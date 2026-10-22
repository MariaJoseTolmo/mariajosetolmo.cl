import { InfrastructureUnavailable } from '../../../shared/domain/errors';
import { withRedis } from './redis-errors';

describe('withRedis', () => {
  it('returns the value of a successful operation', async () => {
    await expect(withRedis(() => Promise.resolve('PONG'))).resolves.toBe(
      'PONG',
    );
  });

  it('turns a connection failure into InfrastructureUnavailable, keeping the cause', async () => {
    const cause = new Error('connect ECONNREFUSED 10.0.0.5:6379');
    const failure = await withRedis(() => Promise.reject(cause)).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(InfrastructureUnavailable);
    expect((failure as InfrastructureUnavailable).cause).toBe(cause);
    // The public message carries no host and no port.
    expect((failure as InfrastructureUnavailable).message).toBe(
      'Service temporarily unavailable',
    );
  });

  it('also covers an operation that throws before returning a promise', async () => {
    await expect(
      withRedis(() => {
        throw new Error('Stream is not writeable');
      }),
    ).rejects.toBeInstanceOf(InfrastructureUnavailable);
  });

  it('does not wrap an InfrastructureUnavailable a second time', async () => {
    const original = new InfrastructureUnavailable(new Error('inner'));
    await expect(withRedis(() => Promise.reject(original))).rejects.toBe(
      original,
    );
  });
});
