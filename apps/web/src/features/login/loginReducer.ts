import type { ApiFailure } from '@/lib/api/types';

export type LoginState =
  | { status: 'editing' }
  | { status: 'submitting'; email: string }
  | { status: 'sent'; email: string }
  | { status: 'error'; failure: ApiFailure };

export type LoginEvent =
  | { type: 'SUBMIT'; email: string }
  | { type: 'SUCCEEDED' }
  | { type: 'FAILED'; failure: ApiFailure }
  | { type: 'RESET' };

export const initialLoginState: LoginState = { status: 'editing' };

export function loginReducer(state: LoginState, event: LoginEvent): LoginState {
  switch (event.type) {
    case 'SUBMIT':
      return state.status === 'editing' || state.status === 'error'
        ? { status: 'submitting', email: event.email }
        : state;
    case 'SUCCEEDED':
      return state.status === 'submitting'
        ? { status: 'sent', email: state.email }
        : state;
    case 'FAILED':
      return state.status === 'submitting'
        ? { status: 'error', failure: event.failure }
        : state;
    case 'RESET':
      return initialLoginState;
  }
}

/** Index of the highlighted step in "Detrás de este formulario". */
export function stepIndex(state: LoginState): number {
  return state.status === 'sent' ? 1 : 0;
}
