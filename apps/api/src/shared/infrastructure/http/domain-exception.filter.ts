import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainError } from '../../domain/errors';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
}

/** Status per DomainError code (design 11). Unlisted codes become 500. */
const STATUS_BY_CODE: Readonly<Record<string, HttpStatus>> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  INFRASTRUCTURE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

const REASON: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

/** Translates domain errors into the same JSON shape Nest uses, no internals. */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  constructor(
    private readonly logger: Pick<Logger, 'error'> = new Logger(
      DomainExceptionFilter.name,
    ),
  ) {}

  catch(error: DomainError, host: ArgumentsHost): void {
    const status =
      STATUS_BY_CODE[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logFailure(error);
    const message =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : error.message;
    host
      .switchToHttp()
      .getResponse<JsonResponse>()
      .status(status)
      .json({ statusCode: status, error: REASON[status], message });
  }

  private logFailure(error: DomainError): void {
    const cause =
      error.cause instanceof Error ? ` (cause: ${error.cause.message})` : '';
    this.logger.error(`${error.code}: ${error.message}${cause}`);
  }
}
