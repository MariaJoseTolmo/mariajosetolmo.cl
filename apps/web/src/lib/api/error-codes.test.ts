import { API_ERROR_CODES as API_CATALOG } from '../../../../api/src/shared/infrastructure/http/api-error-code';
import { API_ERROR_CODES } from './error-codes';

describe('API error code contract', () => {
  it('mirrors the API catalog in content and order', () => {
    expect([...API_ERROR_CODES]).toEqual([...API_CATALOG]);
  });
});
