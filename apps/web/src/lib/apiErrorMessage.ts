import { apiErrors } from '@/content/apiErrors';
import type { ApiErrorReason } from '@/lib/api/error-codes';
import type { ApiErrorKind, ApiFailure } from '@/lib/api/types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export type ApiErrorOverrides = Partial<
  Record<ApiErrorReason | ApiErrorKind, string>
>;

/** Rounds up: under a minute, minutes under an hour, hours from there. */
export function formatWait(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  const { wait } = apiErrors;
  if (seconds < SECONDS_PER_MINUTE) return wait.seconds;
  if (seconds < SECONDS_PER_HOUR) {
    const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
    return minutes === 1
      ? wait.minute
      : wait.minutes.replace('{count}', String(minutes));
  }
  const hours = Math.ceil(seconds / SECONDS_PER_HOUR);
  return hours === 1 ? wait.hour : wait.hours.replace('{count}', String(hours));
}

/**
 * The only place that turns an `ApiFailure` into copy. Order: override of the
 * reason, text of the reason, override of the kind, text of the kind. The
 * API `message` is never read.
 */
export function apiErrorMessage(
  failure: ApiFailure,
  overrides: ApiErrorOverrides = {},
): string {
  const { reason, error } = failure;
  const template =
    (reason && overrides[reason]) ||
    (reason && apiErrors.reasons[reason]) ||
    overrides[error] ||
    apiErrors.kinds[error];
  if (!template.includes('{wait}')) return template;
  const wait = formatWait(failure.retryAfterSeconds);
  if (wait !== undefined) return template.replace('{wait}', wait);
  // `waitUnknown` is a whole rate-limit sentence: only valid for that kind.
  return failure.error === 'rate-limited'
    ? apiErrors.waitUnknown
    : template.replace('{wait}', apiErrors.waitNeutral);
}
