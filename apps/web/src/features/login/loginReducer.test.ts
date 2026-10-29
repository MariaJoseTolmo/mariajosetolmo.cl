import {
  initialLoginState,
  loginReducer,
  stepIndex,
  type LoginState,
} from './loginReducer';
import type { ApiFailure } from '@/lib/api/types';

const submitting: LoginState = { status: 'submitting', email: 'a@b.cl' };
const networkFailure: ApiFailure = { error: 'network' };

describe('loginReducer', () => {
  it('starts editing', () => {
    expect(initialLoginState).toEqual({ status: 'editing' });
  });

  it('editing -> submitting on SUBMIT, remembering the email', () => {
    expect(
      loginReducer(initialLoginState, { type: 'SUBMIT', email: 'a@b.cl' }),
    ).toEqual(submitting);
  });

  it('submitting -> sent on SUCCEEDED, keeping the email', () => {
    expect(loginReducer(submitting, { type: 'SUCCEEDED' })).toEqual({
      status: 'sent',
      email: 'a@b.cl',
    });
  });

  it('submitting -> error on FAILED, carrying the whole failure', () => {
    const failure: ApiFailure = {
      error: 'rate-limited',
      status: 429,
      reason: 'RATE_LIMITED',
      retryAfterSeconds: 60,
    };
    expect(loginReducer(submitting, { type: 'FAILED', failure })).toEqual({
      status: 'error',
      failure,
    });
  });

  it('error -> submitting on SUBMIT (retry)', () => {
    const error: LoginState = { status: 'error', failure: networkFailure };
    expect(loginReducer(error, { type: 'SUBMIT', email: 'x@y.cl' })).toEqual({
      status: 'submitting',
      email: 'x@y.cl',
    });
  });

  it.each<LoginState>([
    submitting,
    { status: 'sent', email: 'a@b.cl' },
    { status: 'error', failure: networkFailure },
  ])('RESET returns to editing from %j', (state) => {
    expect(loginReducer(state, { type: 'RESET' })).toEqual({
      status: 'editing',
    });
  });

  it('ignores events that do not apply to the current state', () => {
    const sent: LoginState = { status: 'sent', email: 'a@b.cl' };
    expect(loginReducer(sent, { type: 'SUBMIT', email: 'z@z.cl' })).toBe(sent);
    expect(loginReducer(submitting, { type: 'SUBMIT', email: 'z@z.cl' })).toBe(
      submitting,
    );
    expect(loginReducer(initialLoginState, { type: 'SUCCEEDED' })).toBe(
      initialLoginState,
    );
    expect(
      loginReducer(sent, { type: 'FAILED', failure: networkFailure }),
    ).toBe(sent);
  });
});

describe('stepIndex', () => {
  it.each([
    [{ status: 'editing' }, 0],
    [{ status: 'submitting', email: 'a@b.cl' }, 0],
    [{ status: 'error', failure: networkFailure }, 0],
    [{ status: 'sent', email: 'a@b.cl' }, 1],
  ] as const)('maps %j to step %i', (state, step) => {
    expect(stepIndex(state)).toBe(step);
  });
});
