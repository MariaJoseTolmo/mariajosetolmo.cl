import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  CdnRequired,
  DomainError,
  type DomainErrorCode,
  InfrastructureUnavailable,
  InvalidInput,
  InvalidToken,
  OriginNotAllowed,
  RateLimited,
  RoleNotAllowed,
  Unauthenticated,
} from '../../domain/errors';
import { API_ERROR_CODES } from './api-error-code';
import { ApiExceptionFilter } from './api-exception.filter';

class UnmappedError extends DomainError {
  readonly code = 'SOMETHING_NEW' as DomainErrorCode;
}

interface Captured {
  status?: number;
  body?: Record<string, unknown>;
  headers: Record<string, string>;
}

function hostFor(captured: Captured): ArgumentsHost {
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return res;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return res;
    },
  };
  return {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

function run(exception: unknown): { captured: Captured; logged: unknown[] } {
  const captured: Captured = { headers: {} };
  const logged: unknown[] = [];
  new ApiExceptionFilter({
    error: (message: unknown) => logged.push(message),
  }).catch(exception, hostFor(captured));
  return { captured, logged };
}

/** What body-parser throws: a plain Error that carries an HTTP status. */
function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode, status: statusCode });
}

const KEYS = ['code', 'error', 'message', 'statusCode'];

describe('ApiExceptionFilter', () => {
  describe('domain errors', () => {
    it.each([
      [new InvalidInput('email is invalid'), 400, 'INVALID_INPUT'],
      [new InvalidToken('token is invalid'), 400, 'INVALID_TOKEN'],
      [new Unauthenticated(), 401, 'UNAUTHENTICATED'],
      [new CdnRequired(), 403, 'CDN_REQUIRED'],
      [new OriginNotAllowed(), 403, 'ORIGIN_NOT_ALLOWED'],
      [new RoleNotAllowed(), 403, 'ROLE_NOT_ALLOWED'],
      [new RateLimited(754), 429, 'RATE_LIMITED'],
      [new InfrastructureUnavailable(), 503, 'SERVICE_UNAVAILABLE'],
    ])('maps %p to %i %s', (error, status, code) => {
      const { captured } = run(error);
      expect(captured.status).toBe(status);
      expect(captured.body?.['statusCode']).toBe(status);
      expect(captured.body?.['code']).toBe(code);
      expect(API_ERROR_CODES).toContain(code);
    });

    it('keeps the domain message for 4xx and the exact four keys', () => {
      const { captured } = run(new InvalidInput('email is invalid'));
      expect(Object.keys(captured.body ?? {}).sort()).toEqual(KEYS);
      expect(captured.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'email is invalid',
        code: 'INVALID_INPUT',
      });
    });

    it('answers 429 with Retry-After in seconds, taken from the error', () => {
      const { captured } = run(new RateLimited(754));
      expect(captured.headers).toEqual({ 'Retry-After': '754' });
      expect(captured.body?.['error']).toBe('Too Many Requests');
    });

    it.each([
      new InvalidInput('x'),
      new Unauthenticated(),
      new CdnRequired(),
      new InfrastructureUnavailable(),
    ])('sets no Retry-After on %p', (error) => {
      expect(run(error).captured.headers).toEqual({});
    });

    it('answers 503 with a generic body and never leaks the cause', () => {
      const cause = new Error(
        'SELECT * FROM users WHERE email = $1 at /srv/app/node_modules/pg/lib/client.js:42',
      );
      const { captured } = run(new InfrastructureUnavailable(cause));
      expect(captured.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(JSON.stringify(captured.body)).not.toMatch(
        /stack|SELECT|node_modules|\.js:/i,
      );
    });

    it('logs the cause of a 5xx server-side only', () => {
      const { logged } = run(
        new InfrastructureUnavailable(new Error('boom host-1')),
      );
      expect(logged).toHaveLength(1);
      expect(String(logged[0])).toContain('boom host-1');
    });

    it('does not log expected 4xx outcomes', () => {
      expect(run(new InvalidInput('bad')).logged).toHaveLength(0);
      expect(run(new RoleNotAllowed()).logged).toHaveLength(0);
    });

    it('turns a domain code without an entry into a generic 500', () => {
      const { captured, logged } = run(new UnmappedError('internal detail'));
      expect(captured.status).toBe(500);
      expect(captured.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
      expect(logged).toHaveLength(1);
    });
  });

  describe('HttpException and http errors, by status', () => {
    it.each([
      [new BadRequestException('leaks {"email":'), 400, 'INVALID_INPUT'],
      [new HttpException('too big', 413), 413, 'INVALID_INPUT'],
      [new HttpException('media', 415), 415, 'INVALID_INPUT'],
      [new HttpException('teapot', 418), 418, 'INVALID_INPUT'],
      [new HttpException('who', 401), 401, 'UNAUTHENTICATED'],
      [new HttpException('missing', 429), 429, 'RATE_LIMITED'],
      [new HttpException('down', 503), 503, 'SERVICE_UNAVAILABLE'],
      [new HttpException('boom', 500), 500, 'INTERNAL_ERROR'],
      [new HttpException('gateway', 502), 502, 'INTERNAL_ERROR'],
      [httpError(400, 'Unexpected end of JSON input'), 400, 'INVALID_INPUT'],
      [httpError(413, 'request entity too large'), 413, 'INVALID_INPUT'],
    ])('maps %p to %i %s', (exception, status, code) => {
      const { captured } = run(exception);
      expect(captured.status).toBe(status === 502 ? 500 : status);
      expect(captured.body?.['code']).toBe(code);
      expect(Object.keys(captured.body ?? {}).sort()).toEqual(KEYS);
    });

    it('answers 404 with a fixed message that does not repeat the route', () => {
      const { captured } = run(
        new NotFoundException('Cannot GET /api/secret-path'),
      );
      expect(captured.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Not found',
        code: 'NOT_FOUND',
      });
    });

    it('never echoes the original message of the exception', () => {
      const { captured } = run(httpError(400, 'Unexpected token x in {"a":'));
      expect(JSON.stringify(captured.body)).not.toContain('Unexpected');
      expect(JSON.stringify(captured.body)).not.toContain('{"a"');
    });

    it('sets no Retry-After for an HttpException 429', () => {
      expect(run(new HttpException('slow', 429)).captured.headers).toEqual({});
    });

    it('logs a 5xx HttpException and not a 4xx one', () => {
      expect(run(new HttpException('boom', 500)).logged).toHaveLength(1);
      expect(run(new BadRequestException()).logged).toHaveLength(0);
    });
  });

  describe('unknown exceptions', () => {
    it.each([
      new Error('connect ECONNREFUSED 10.0.0.1:5432 secret-token'),
      'a string',
      null,
      { weird: true },
    ])('answers %p with a fixed 500 and logs it', (exception) => {
      const { captured, logged } = run(exception);
      expect(captured.status).toBe(500);
      expect(captured.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
      expect(captured.headers).toEqual({});
      expect(logged).toHaveLength(1);
    });

    it('logs the exception text server-side only', () => {
      const { captured, logged } = run(new Error('secret-token'));
      expect(String(logged[0])).toContain('secret-token');
      expect(JSON.stringify(captured.body)).not.toContain('secret-token');
    });
  });
});
