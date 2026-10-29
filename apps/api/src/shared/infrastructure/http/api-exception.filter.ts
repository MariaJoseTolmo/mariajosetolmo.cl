import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  DomainError,
  type DomainErrorCode,
  RateLimited,
} from '../../domain/errors';
import type { ApiErrorCode } from './api-error-code';

interface JsonResponse {
  status(code: number): JsonResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}

interface Mapping {
  readonly status: HttpStatus;
  readonly code: ApiErrorCode;
}

/** Public status and code per domain code. Exhaustive: a new code fails the build. */
const DOMAIN_MAPPING: Readonly<Record<DomainErrorCode, Mapping>> = {
  INVALID_INPUT: { status: HttpStatus.BAD_REQUEST, code: 'INVALID_INPUT' },
  INVALID_TOKEN: { status: HttpStatus.BAD_REQUEST, code: 'INVALID_TOKEN' },
  UNAUTHENTICATED: {
    status: HttpStatus.UNAUTHORIZED,
    code: 'UNAUTHENTICATED',
  },
  CDN_REQUIRED: { status: HttpStatus.FORBIDDEN, code: 'CDN_REQUIRED' },
  ORIGIN_NOT_ALLOWED: {
    status: HttpStatus.FORBIDDEN,
    code: 'ORIGIN_NOT_ALLOWED',
  },
  ROLE_NOT_ALLOWED: { status: HttpStatus.FORBIDDEN, code: 'ROLE_NOT_ALLOWED' },
  RATE_LIMITED: { status: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED' },
  INFRASTRUCTURE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'SERVICE_UNAVAILABLE',
  },
};

const INTERNAL: Mapping = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_ERROR',
};

/** Fixed message per code for errors that do not come from the domain. */
const FIXED_MESSAGE: Readonly<Record<ApiErrorCode, string>> = {
  INVALID_INPUT: 'Invalid input',
  INVALID_TOKEN: 'Invalid token',
  UNAUTHENTICATED: 'Authentication required',
  CDN_REQUIRED: 'Request did not come through the CDN',
  ORIGIN_NOT_ALLOWED: 'Origin not allowed',
  ROLE_NOT_ALLOWED: 'Role not allowed',
  NOT_FOUND: 'Not found',
  RATE_LIMITED: 'Too many requests',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  INTERNAL_ERROR: 'Internal server error',
};

const SPECIAL_STATUS: Readonly<Record<number, ApiErrorCode | undefined>> = {
  401: 'UNAUTHENTICATED',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
};

/** Public mapping for an HTTP status coming from Nest or body-parser. */
function mappingForStatus(status: number): Mapping {
  const special = SPECIAL_STATUS[status];
  if (special) return { status, code: special };
  return status >= 400 && status < 500
    ? { status, code: 'INVALID_INPUT' }
    : INTERNAL;
}

/** The status of a Nest HttpException or of a body-parser (http-errors) error. */
function httpStatusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { statusCode } = exception as { statusCode?: unknown };
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600
    ? statusCode
    : undefined;
}

/**
 * The single translation point to the public error body
 * `{statusCode, error, message, code}`. Never echoes what the client sent.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Pick<Logger, 'error'> = new Logger(
      ApiExceptionFilter.name,
    ),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<JsonResponse>();
    if (exception instanceof DomainError) {
      this.respondDomain(exception, res);
      return;
    }
    const status = httpStatusOf(exception);
    if (status !== undefined) {
      const mapping = mappingForStatus(status);
      if (mapping.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logFailure(exception);
      }
      this.send(res, mapping, FIXED_MESSAGE[mapping.code]);
      return;
    }
    this.logFailure(exception);
    this.send(res, INTERNAL, FIXED_MESSAGE.INTERNAL_ERROR);
  }

  private respondDomain(error: DomainError, res: JsonResponse): void {
    const mapping = (
      DOMAIN_MAPPING as Readonly<Record<string, Mapping | undefined>>
    )[error.code];
    if (!mapping || mapping.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logFailure(error);
    }
    if (!mapping) {
      this.send(res, INTERNAL, FIXED_MESSAGE.INTERNAL_ERROR);
      return;
    }
    if (error instanceof RateLimited) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    // Domain messages are written by us and never carry client input.
    const message =
      mapping.status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? FIXED_MESSAGE[mapping.code]
        : error.message;
    this.send(res, mapping, message);
  }

  private send(res: JsonResponse, mapping: Mapping, message: string): void {
    res.status(mapping.status).json({
      statusCode: mapping.status,
      error: STATUS_CODES[mapping.status] ?? 'Error',
      message,
      code: mapping.code,
    });
  }

  private logFailure(exception: unknown): void {
    const cause =
      exception instanceof Error && exception.cause instanceof Error
        ? ` (cause: ${exception.cause.message})`
        : '';
    const text =
      exception instanceof DomainError
        ? `${exception.code}: ${exception.message}`
        : exception instanceof Error
          ? `${exception.name}: ${exception.message}`
          : `Non-error thrown: ${String(exception)}`;
    this.logger.error(`${text}${cause}`);
  }
}
