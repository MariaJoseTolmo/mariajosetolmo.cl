import { login } from '@/content/login';
import type { ApiErrorOverrides } from '@/lib/apiErrorMessage';

/** Login-specific copy on top of the API error dictionary (design section 5). */
export const loginOverrides: ApiErrorOverrides = {
  INVALID_INPUT: login.form.invalidInputError,
  INTERNAL_ERROR: login.form.serverError,
  server: login.form.serverError,
  network: login.form.networkError,
};
