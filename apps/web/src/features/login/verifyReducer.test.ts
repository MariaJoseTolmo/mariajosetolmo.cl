import {
  errorVariant,
  initialVerifyState,
  verifyReducer,
  verifyStepIndex,
  verifyView,
} from './verifyReducer';

describe('verifyReducer', () => {
  it('starts ready and moves to confirming on CONFIRM', () => {
    expect(initialVerifyState).toEqual({ status: 'ready' });
    expect(verifyReducer(initialVerifyState, { type: 'CONFIRM' })).toEqual({
      status: 'confirming',
    });
  });

  it('confirming ends in done or error', () => {
    const confirming = { status: 'confirming' } as const;
    expect(verifyReducer(confirming, { type: 'SUCCEEDED' })).toEqual({
      status: 'done',
    });
    expect(
      verifyReducer(confirming, { type: 'FAILED', kind: 'invalid-token' }),
    ).toEqual({ status: 'error', kind: 'invalid-token' });
  });

  it('allows retrying after an error but never re-confirms once done', () => {
    expect(
      verifyReducer({ status: 'error', kind: 'network' }, { type: 'CONFIRM' }),
    ).toEqual({ status: 'confirming' });
    const done = { status: 'done' } as const;
    expect(verifyReducer(done, { type: 'CONFIRM' })).toBe(done);
  });

  it('ignores results that arrive outside confirming', () => {
    const ready = { status: 'ready' } as const;
    expect(verifyReducer(ready, { type: 'SUCCEEDED' })).toBe(ready);
    expect(verifyReducer(ready, { type: 'FAILED', kind: 'network' })).toBe(
      ready,
    );
    const confirming = { status: 'confirming' } as const;
    expect(verifyReducer(confirming, { type: 'CONFIRM' })).toBe(confirming);
  });
});

describe('verifyView', () => {
  it('stays neutral until the token has been read', () => {
    expect(verifyView({ status: 'pending' }, { status: 'ready' })).toEqual({
      status: 'pending',
    });
  });

  it('shows the invalid link when there is no token', () => {
    expect(verifyView({ status: 'missing' }, { status: 'ready' })).toEqual({
      status: 'error',
      variant: 'invalid',
    });
  });

  it('follows the reducer once a token was found', () => {
    const found = { status: 'found', token: 't' } as const;
    expect(verifyView(found, { status: 'ready' })).toEqual({ status: 'ready' });
    expect(verifyView(found, { status: 'confirming' })).toEqual({
      status: 'confirming',
    });
    expect(verifyView(found, { status: 'done' })).toEqual({ status: 'done' });
    expect(verifyView(found, { status: 'error', kind: 'network' })).toEqual({
      status: 'error',
      variant: 'unavailable',
    });
  });
});

describe('errorVariant', () => {
  it.each([
    ['invalid-token', 'invalid'],
    ['unexpected', 'invalid'],
    ['unauthorized', 'invalid'],
    ['forbidden', 'invalid'],
    ['rate-limited', 'rate-limited'],
    ['network', 'unavailable'],
    ['server', 'unavailable'],
  ] as const)('%s -> %s', (kind, variant) => {
    expect(errorVariant(kind)).toBe(variant);
  });
});

describe('verifyStepIndex', () => {
  it('highlights the confirmation step, then the final one when done', () => {
    expect(verifyStepIndex({ status: 'ready' })).toBe(2);
    expect(verifyStepIndex({ status: 'pending' })).toBe(2);
    expect(verifyStepIndex({ status: 'done' })).toBe(3);
  });
});
