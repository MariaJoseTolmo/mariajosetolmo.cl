import { InfrastructureUnavailable } from '../../domain/errors';

/**
 * Any database failure (refused, timed out, not initialised) becomes one
 * domain error, so callers fail closed with 503. The driver error rides along
 * as `cause` for the server log; it can carry SQL, hosts or credentials.
 */
export async function withDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InfrastructureUnavailable) throw error;
    throw new InfrastructureUnavailable(error);
  }
}
