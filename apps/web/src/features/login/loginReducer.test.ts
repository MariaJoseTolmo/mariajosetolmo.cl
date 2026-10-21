import {
  initialLoginState,
  loginReducer,
  stepIndex,
  type LoginState,
} from './loginReducer';

const submitting: LoginState = { status: 'submitting', email: 'a@b.cl' };

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

  it('submitting -> error on FAILED, carrying the kind', () => {
    expect(
      loginReducer(submitting, { type: 'FAILED', kind: 'network' }),
    ).toEqual({ status: 'error', kind: 'network' });
  });

  it('error -> submitting on SUBMIT (retry)', () => {
    const error: LoginState = { status: 'error', kind: 'network' };
    expect(loginReducer(error, { type: 'SUBMIT', email: 'x@y.cl' })).toEqual({
      status: 'submitting',
      email: 'x@y.cl',
    });
  });

  it.each<LoginState>([
    submitting,
    { status: 'sent', email: 'a@b.cl' },
    { status: 'error', kind: 'network' },
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
    expect(loginReducer(sent, { type: 'FAILED', kind: 'network' })).toBe(sent);
  });
});

describe('stepIndex', () => {
  it.each([
    [{ status: 'editing' }, 0],
    [{ status: 'submitting', email: 'a@b.cl' }, 0],
    [{ status: 'error', kind: 'network' }, 0],
    [{ status: 'sent', email: 'a@b.cl' }, 1],
  ] as const)('maps %j to step %i', (state, step) => {
    expect(stepIndex(state)).toBe(step);
  });
});
