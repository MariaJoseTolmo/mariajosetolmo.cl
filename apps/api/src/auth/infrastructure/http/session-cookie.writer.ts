import { SessionPolicy } from '../../domain/session-policy';
import { cookieNamesFor, type CookieNames } from './cookie-names';

/** The slice of an HTTP response the writer needs (Express provides it). */
export interface HeaderSink {
  append(name: string, value: string): unknown;
}

export interface IssuedSession {
  readonly accessJwt: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

const ACCESS_PATH = '/';
const REFRESH_PATH = '/api/auth';
// JWT and base64url characters only: nothing that can end a cookie value.
const SAFE_COOKIE_VALUE = /^[A-Za-z0-9._~-]+$/;

/** The only place that emits Set-Cookie (design 8). */
export class SessionCookieWriter {
  private readonly names: CookieNames;

  constructor(private readonly secure: boolean) {
    this.names = cookieNamesFor(secure);
  }

  write(res: HeaderSink, session: IssuedSession, now: Date): void {
    res.append(
      'Set-Cookie',
      this.serialize(
        this.names.access,
        session.accessJwt,
        ACCESS_PATH,
        SessionPolicy.ACCESS_TTL_SECONDS,
      ),
    );
    res.append(
      'Set-Cookie',
      this.serialize(
        this.names.refresh,
        session.refreshToken,
        REFRESH_PATH,
        SessionPolicy.refreshCookieMaxAge(session.refreshExpiresAt, now),
      ),
    );
  }

  clear(res: HeaderSink): void {
    res.append(
      'Set-Cookie',
      this.serialize(this.names.access, '', ACCESS_PATH, 0),
    );
    res.append(
      'Set-Cookie',
      this.serialize(this.names.refresh, '', REFRESH_PATH, 0),
    );
  }

  private serialize(
    name: string,
    value: string,
    path: string,
    maxAge: number,
  ): string {
    if (value !== '' && !SAFE_COOKIE_VALUE.test(value)) {
      throw new Error('Invalid cookie value');
    }
    const parts = [
      `${name}=${value}`,
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
    ];
    if (this.secure) parts.push('Secure');
    parts.push('SameSite=Strict');
    return parts.join('; ');
  }
}
