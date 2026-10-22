import { sha256Hex } from '../../shared/domain/hash';
import { MalformedToken } from './auth-errors';
import {
  type ByteSource,
  generateOpaqueToken,
  isOpaqueToken,
} from './opaque-token';

/** A magic-link token: the clear value goes in the email, only the hash is stored. */
export class MagicLinkToken {
  private constructor(
    readonly value: string,
    readonly hash: string,
  ) {}

  static generate(random: ByteSource): MagicLinkToken {
    return MagicLinkToken.of(generateOpaqueToken(random));
  }

  static parse(raw: unknown): MagicLinkToken {
    if (!isOpaqueToken(raw)) throw new MalformedToken();
    return MagicLinkToken.of(raw);
  }

  private static of(value: string): MagicLinkToken {
    return new MagicLinkToken(value, sha256Hex(value));
  }
}

/**
 * `<base>/#token=<token>`: the token travels in the fragment, which browsers
 * never send to servers, proxies or logs. The base path keeps a trailing slash
 * because the page lives at `/acceso/verificar/`.
 */
export function magicLinkUrl(baseUrl: string, token: string): string {
  const url = new URL(baseUrl);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = `token=${token}`;
  return url.toString();
}
