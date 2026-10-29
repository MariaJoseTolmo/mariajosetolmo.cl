import { API_ERROR_CODES } from '../../src/shared/infrastructure/http/api-error-code';

/** Fails when a response carries a `code` that is not in the public catalog. */
export function assertCatalogCode(code: unknown): void {
  const known: readonly unknown[] = API_ERROR_CODES;
  if (!known.includes(code)) {
    throw new Error(`error code ${JSON.stringify(code)} is not in the catalog`);
  }
}
