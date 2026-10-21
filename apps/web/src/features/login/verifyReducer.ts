import type { ApiErrorKind } from '@/lib/api/types';
import type { MagicLinkToken } from './useMagicLinkToken';

export type VerifyState =
  | { status: 'ready' }
  | { status: 'confirming' }
  | { status: 'done' }
  | { status: 'error'; kind: ApiErrorKind };

export type VerifyEvent =
  | { type: 'CONFIRM' }
  | { type: 'SUCCEEDED' }
  | { type: 'FAILED'; kind: ApiErrorKind };

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
        ? { status: 'error', kind: event.kind }
        : state;
  }
}

/** How a failure is explained to the user. */
export type ErrorVariant = 'invalid' | 'rate-limited' | 'unavailable';

export function errorVariant(kind: ApiErrorKind): ErrorVariant {
  if (kind === 'rate-limited') return 'rate-limited';
  if (kind === 'network' || kind === 'server') return 'unavailable';
  return 'invalid';
}

export type VerifyViewState =
  | { status: 'pending' | 'ready' | 'confirming' | 'done' }
  | { status: 'error'; variant: ErrorVariant };

/** What to show, given the token capture and the confirmation progress. */
export function verifyView(
  token: MagicLinkToken,
  state: VerifyState,
): VerifyViewState {
  if (token.status === 'pending') return { status: 'pending' };
  if (token.status === 'missing')
    return { status: 'error', variant: 'invalid' };
  if (state.status === 'error') {
    return { status: 'error', variant: errorVariant(state.kind) };
  }
  return { status: state.status };
}

/** Index of the highlighted step in "Detrás de este formulario". */
export function verifyStepIndex(view: Pick<VerifyViewState, 'status'>): number {
  return view.status === 'done' ? 3 : 2;
}
