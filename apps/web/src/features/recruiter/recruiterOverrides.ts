import { recruiter } from '@/content/recruiter';
import type { ApiErrorOverrides } from '@/lib/apiErrorMessage';

/** Zone-specific copy on top of the API error dictionary (design section 5). */
export const cvOverrides: ApiErrorOverrides = {
  unexpected: recruiter.cv.failed,
};

export const logoutOverrides: ApiErrorOverrides = {
  unexpected: recruiter.session.logoutFailed,
};

export const playgroundOverrides: ApiErrorOverrides = {
  ROLE_NOT_ALLOWED: recruiter.playground.roleNotAllowed,
};
