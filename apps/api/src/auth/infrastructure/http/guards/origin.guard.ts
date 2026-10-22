import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../../../config/app-config';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface OriginRequest {
  readonly method: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/** CSRF defence in depth: mutating requests must come from an allowed origin. */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: ReadonlySet<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.allowed = new Set(config.allowedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<OriginRequest>();
    if (!MUTATING_METHODS.has(req.method)) return true;
    const origin = req.headers['origin'];
    if (typeof origin === 'string' && this.allowed.has(origin)) return true;
    throw new ForbiddenException('Origin not allowed');
  }
}
