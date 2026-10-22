import type { ArgumentsHost } from '@nestjs/common';
import {
  DomainError,
  Forbidden,
  InfrastructureUnavailable,
  InvalidInput,
  RateLimited,
  Unauthenticated,
} from '../../domain/errors';
import { DomainExceptionFilter } from './domain-exception.filter';

class UnmappedError extends DomainError {
  readonly code = 'SOMETHING_NEW';
}

interface Captured {
  status?: number;
  body?: unknown;
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
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  };
  return {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

function run(error: DomainError): { captured: Captured; logged: unknown[] } {
  const captured: Captured = { headers: {} };
  const logged: unknown[] = [];
  new DomainExceptionFilter({
    error: (message: unknown) => logged.push(message),
  }).catch(error, hostFor(captured));
  return { captured, logged };
}

describe('DomainExceptionFilter', () => {
  it.each([
    [
      new InvalidInput('email is malformed'),
      400,
      'Bad Request',
      'email is malformed',
    ],
    [new Unauthenticated(), 401, 'Unauthorized', 'Authentication required'],
    [new Forbidden('not via the CDN'), 403, 'Forbidden', 'not via the CDN'],
  ])('maps %p to %i with a JSON body', (error, status, reason, message) => {
    const { captured } = run(error);
    expect(captured.status).toBe(status);
    expect(captured.body).toEqual({
      statusCode: status,
      error: reason,
      message,
    });
  });

  it('answers 429 with Retry-After taken from the error', () => {
    const { captured } = run(new RateLimited(754));
    expect(captured.status).toBe(429);
    expect(captured.headers).toEqual({ 'Retry-After': '754' });
    expect(captured.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many requests',
    });
  });

  it('sets no Retry-After on other errors', () => {
    expect(run(new Forbidden('no')).captured.headers).toEqual({});
  });

  it('answers 503 with a generic body and never leaks the cause', () => {
    const cause = new Error(
      'SELECT * FROM users WHERE email = $1 at /srv/app/node_modules/pg/lib/client.js:42',
    );
    const { captured } = run(new InfrastructureUnavailable(cause));
    expect(captured.status).toBe(503);
    expect(captured.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service temporarily unavailable',
    });
    const json = JSON.stringify(captured.body);
    expect(json).not.toMatch(/stack|SELECT|node_modules|\.js:/i);
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
  });

  it('turns an unmapped DomainError into a generic 500', () => {
    const { captured, logged } = run(new UnmappedError('internal detail'));
    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(logged).toHaveLength(1);
  });
});
