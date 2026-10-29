import { apiErrors } from '@/content/apiErrors';
import type { ApiFailure } from '@/lib/api/types';
import { apiErrorMessage, formatWait } from './apiErrorMessage';

const fail = (extra: Partial<ApiFailure> & Pick<ApiFailure, 'error'>) => extra;

describe('formatWait', () => {
  it.each([
    [30, 'unos segundos'],
    [59, 'unos segundos'],
    [60, 'un minuto'],
    [61, '2 minutos'],
    [120, '2 minutos'],
    [3599, '60 minutos'],
    [3600, 'una hora'],
    [3601, '2 horas'],
    [7200, '2 horas'],
  ])('formats %i seconds as %s', (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });

  it('is undefined without a known time', () => {
    expect(formatWait(undefined)).toBeUndefined();
  });
});

describe('apiErrorMessage resolution order', () => {
  const failure = fail({
    error: 'server',
    status: 503,
    reason: 'SERVICE_UNAVAILABLE',
  });

  it('prefers the override of the reason', () => {
    expect(
      apiErrorMessage(failure, {
        SERVICE_UNAVAILABLE: 'override reason',
        server: 'override kind',
      }),
    ).toBe('override reason');
  });

  it('then the dictionary text of the reason, ahead of the kind override', () => {
    expect(apiErrorMessage(failure, { server: 'override kind' })).toBe(
      apiErrors.reasons.SERVICE_UNAVAILABLE,
    );
  });

  it('falls to the kind override without a reason', () => {
    expect(
      apiErrorMessage(fail({ error: 'server' }), { server: 'override kind' }),
    ).toBe('override kind');
  });

  it('then the dictionary text of the kind', () => {
    expect(apiErrorMessage(fail({ error: 'network' }))).toBe(
      apiErrors.kinds.network,
    );
  });

  it('uses the kind copy when there is no reason', () => {
    expect(apiErrorMessage(fail({ error: 'forbidden', status: 403 }))).toBe(
      apiErrors.kinds.forbidden,
    );
  });
});

describe('apiErrorMessage {wait} substitution', () => {
  const limited = (retryAfterSeconds?: number): ApiFailure => ({
    error: 'rate-limited',
    status: 429,
    reason: 'RATE_LIMITED',
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });

  it.each([
    [30, 'unos segundos'],
    [61, '2 minutos'],
    [7200, '2 horas'],
    [60, 'un minuto'],
  ])('puts the rounded time of %i seconds in the text', (seconds, text) => {
    const message = apiErrorMessage(limited(seconds));
    expect(message).toContain(text);
    expect(message).not.toContain('{wait}');
  });

  it('uses the generic wait text when the time is unknown', () => {
    expect(apiErrorMessage(limited())).toBe(apiErrors.waitUnknown);
    expect(apiErrorMessage({ error: 'rate-limited' })).toBe(
      apiErrors.waitUnknown,
    );
  });

  it('uses a neutral phrase, not the rate-limit copy, for other kinds', () => {
    const message = apiErrorMessage(
      { error: 'server', status: 503, reason: 'SERVICE_UNAVAILABLE' },
      { SERVICE_UNAVAILABLE: 'Vuelve en {wait}.' },
    );
    expect(message).toBe(`Vuelve en ${apiErrors.waitNeutral}.`);
    expect(message).not.toContain(apiErrors.waitUnknown);
  });

  it('keeps the rate-limit copy for a rate-limited override without time', () => {
    expect(
      apiErrorMessage(limited(), { RATE_LIMITED: 'Vuelve en {wait}.' }),
    ).toBe(apiErrors.waitUnknown);
  });

  it('substitutes {wait} inside an override too', () => {
    expect(
      apiErrorMessage(limited(120), { RATE_LIMITED: 'Vuelve en {wait}.' }),
    ).toBe('Vuelve en 2 minutos.');
  });
});
