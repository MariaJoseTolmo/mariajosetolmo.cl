import { InfrastructureUnavailable } from '../../../shared/domain/errors';

/**
 * Every Redis failure (refused, timed out, queue flushed) becomes one domain
 * error so the HTTP layer answers 503 and nothing proceeds (fail closed).
 * The original error rides along as `cause` for the server log only.
 */
export async function withRedis<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InfrastructureUnavailable) throw error;
    throw new InfrastructureUnavailable(error);
  }
}
