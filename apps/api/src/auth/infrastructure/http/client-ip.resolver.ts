import { isIP } from 'node:net';
import type { ClientIpSource } from '../../../config/app-config';
import { Forbidden } from '../../../shared/domain/errors';

/** The slice of an HTTP request the resolvers need (Express provides it). */
export interface IpRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly socket: { readonly remoteAddress?: string | undefined };
}

export interface ClientIpResolver {
  resolve(req: IpRequest): string;
}

export const CLIENT_IP_RESOLVER = Symbol('CLIENT_IP_RESOLVER');

const VIEWER_ADDRESS_HEADER = 'cloudfront-viewer-address';
const IPV4_MAPPED_PREFIX = '::ffff:';
const PORT = /^\d{1,5}$/;

function stripIpv4Mapped(address: string): string {
  return address.startsWith(IPV4_MAPPED_PREFIX)
    ? address.slice(IPV4_MAPPED_PREFIX.length)
    : address;
}

/**
 * Production: the only trusted source is the header CloudFront sets. It is
 * `ip:port`, so the port is split at the LAST colon to keep IPv6 intact.
 * X-Forwarded-For is never read. Anything unparsable fails closed.
 */
export class CloudFrontViewerAddressResolver implements ClientIpResolver {
  resolve(req: IpRequest): string {
    const raw = req.headers[VIEWER_ADDRESS_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const lastColon = header?.lastIndexOf(':') ?? -1;
    if (!header || lastColon < 1) throw this.denied();
    const port = header.slice(lastColon + 1);
    const address = stripIpv4Mapped(
      header.slice(0, lastColon).replace(/^\[(.*)\]$/, '$1'),
    );
    if (!PORT.test(port) || isIP(address) === 0) throw this.denied();
    return address;
  }

  private denied(): Forbidden {
    return new Forbidden('Request did not come through the CDN');
  }
}

/** Local and test only: there is no CDN in front of the process. */
export class SocketAddressResolver implements ClientIpResolver {
  resolve(req: IpRequest): string {
    const address = req.socket.remoteAddress;
    if (!address) return 'unknown';
    return stripIpv4Mapped(address);
  }
}

export function createClientIpResolver(
  source: ClientIpSource,
): ClientIpResolver {
  return source === 'cloudfront'
    ? new CloudFrontViewerAddressResolver()
    : new SocketAddressResolver();
}
