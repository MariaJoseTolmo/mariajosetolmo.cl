import type { ApiErrorKind, ApiFailure } from '@/lib/api/types';
import type { MagicLinkToken } from './useMagicLinkToken';

export type VerifyState =
  | { status: 'ready' }
  | { status: 'confirming' }
  | { status: 'done' }
  | { status: 'error'; failure: ApiFailure };

export type VerifyEvent =
  | { type: 'CONFIRM' }
  | { type: 'SUCCEEDED' }
  | { type: 'FAILED'; failure: ApiFailure };

export const initialVerifyState: VerifyState = { status: 'ready' };

export function verifyReducer(
  state: VerifyState,
  event: VerifyEvent,
): VerifyState {
  switch (event.type) {
    case 'CONFIRM':
      return state.status === 'ready' || state.status === 'error'
        ? { status: 'confirming' }
        : state;
    case 'SUCCEEDED':
      return state.status === 'confirming' ? { status: 'done' } : state;
    case 'FAILED':
      return state.status === 'confirming'
        ? { status: 'error', failure: event.failure }
        : state;
  }
}

/** How a failure is explained to the user. */
export type ErrorVariant =
  'invalid' | 'blocked' | 'rate-limited' | 'unavailable';

/** Design section 6: an unknown or rejected token is a single "invalid" state. */
export function errorVariant(kind: ApiErrorKind): ErrorVariant {
  switch (kind) {
    case 'invalid-token':
    case 'invalid-input':
    case 'unauthorized':
      return 'invalid';
    case 'forbidden':
      return 'blocked';
    case 'rate-limited':
      return 'rate-limited';
    case 'network':
    case 'server':
    case 'unexpected':
      return 'unavailable';
  }
}

export type VerifyViewState =
  | { status: 'pending' | 'ready' | 'confirming' | 'done' }
  | { status: 'error'; variant: 'invalid' }
  | {
      status: 'error';
      variant: Exclude<ErrorVariant, 'invalid'>;
      failure: ApiFailure;
    };

/** What to show, given the token capture and the confirmation progress. */
export function verifyView(
  token: MagicLinkToken,
  state: VerifyState,
): VerifyViewState {
  if (token.status === 'pending') return { status: 'pending' };
  if (token.status === 'missing')
    return { status: 'error', variant: 'invalid' };
  if (state.status === 'error') {
    const { failure } = state;
    const variant = errorVariant(failure.error);
    return variant === 'invalid'
      ? { status: 'error', variant }
      : { status: 'error', variant, failure };
  }
  return { status: state.status };
}

/** Index of the highlighted step in "Detrás de este formulario". */
export function verifyStepIndex(view: Pick<VerifyViewState, 'status'>): number {
  return view.status === 'done' ? 3 : 2;
}
