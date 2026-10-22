import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { testConfig } from '../../../../../test/support/test-config';
import { OriginGuard } from './origin.guard';

const ALLOWED = ['https://app.example.test', 'https://www.example.test'];

function contextFor(
  method: string,
  headers: Record<string, string | undefined> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

function guard(allowedOrigins: string[] = ALLOWED): OriginGuard {
  return new OriginGuard(testConfig({ allowedOrigins }));
}

describe('OriginGuard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    '%s without Origin is forbidden',
    (method) => {
      expect(() => guard().canActivate(contextFor(method))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('rejects a foreign Origin on a mutating request', () => {
    expect(() =>
      guard().canActivate(
        contextFor('POST', { origin: 'https://evil.example.test' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([
    'HTTPS://APP.EXAMPLE.TEST',
    'https://app.example.test/',
    'https://app.example.test:8443',
    'http://app.example.test',
    'null',
    '',
  ])('requires an exact match: %j is rejected', (origin) => {
    expect(() => guard().canActivate(contextFor('POST', { origin }))).toThrow(
      ForbiddenException,
    );
  });

  it.each(ALLOWED)('allows a mutating request from %s', (origin) => {
    expect(guard().canActivate(contextFor('POST', { origin }))).toBe(true);
    expect(guard().canActivate(contextFor('DELETE', { origin }))).toBe(true);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s is not affected, with or without Origin',
    (method) => {
      expect(guard().canActivate(contextFor(method))).toBe(true);
      expect(
        guard().canActivate(
          contextFor(method, { origin: 'https://evil.example.test' }),
        ),
      ).toBe(true);
    },
  );

  it('rejects every mutating request when the allow-list is empty', () => {
    expect(() =>
      guard([]).canActivate(
        contextFor('POST', { origin: 'https://app.example.test' }),
      ),
    ).toThrow(ForbiddenException);
  });
});
