import { CdnRequired } from '../../../shared/domain/errors';
import {
  CloudFrontViewerAddressResolver,
  SocketAddressResolver,
  createClientIpResolver,
  type IpRequest,
} from './client-ip.resolver';

function request(
  headers: IpRequest['headers'] = {},
  remoteAddress?: string,
): IpRequest {
  return { headers, socket: { remoteAddress } };
}

describe('CloudFrontViewerAddressResolver', () => {
  const resolver = new CloudFrontViewerAddressResolver();

  it('reads an IPv4 viewer address and drops the port', () => {
    expect(
      resolver.resolve(
        request({ 'cloudfront-viewer-address': '203.0.113.7:46532' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('splits IPv6 at the last colon so the address keeps its colons', () => {
    expect(
      resolver.resolve(
        request({
          'cloudfront-viewer-address': '2001:db8:85a3::8a2e:370:46532',
        }),
      ),
    ).toBe('2001:db8:85a3::8a2e:370');
  });

  it('accepts a bracketed IPv6 viewer address', () => {
    expect(
      resolver.resolve(
        request({ 'cloudfront-viewer-address': '[2001:db8::1]:443' }),
      ),
    ).toBe('2001:db8::1');
  });

  it.each([
    ['missing header', {}],
    ['empty header', { 'cloudfront-viewer-address': '' }],
    ['no port', { 'cloudfront-viewer-address': '203.0.113.7' }],
    ['not an address', { 'cloudfront-viewer-address': 'evil:80' }],
    ['empty port', { 'cloudfront-viewer-address': '203.0.113.7:' }],
    ['non-numeric port', { 'cloudfront-viewer-address': '203.0.113.7:80a' }],
    ['oversized port', { 'cloudfront-viewer-address': '203.0.113.7:123456' }],
  ])('fails closed with CdnRequired on %s', (_name, headers) => {
    expect(() => resolver.resolve(request(headers, '127.0.0.1'))).toThrow(
      CdnRequired,
    );
  });

  it('unwraps IPv4-mapped IPv6 viewer addresses', () => {
    expect(
      resolver.resolve(
        request({ 'cloudfront-viewer-address': '::ffff:203.0.113.7:46532' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('ignores X-Forwarded-For and the socket address', () => {
    expect(
      resolver.resolve(
        request(
          {
            'cloudfront-viewer-address': '203.0.113.7:1',
            'x-forwarded-for': '198.51.100.99',
          },
          '10.0.0.5',
        ),
      ),
    ).toBe('203.0.113.7');
  });

  it('never trusts X-Forwarded-For when the CloudFront header is missing', () => {
    expect(() =>
      resolver.resolve(request({ 'x-forwarded-for': '198.51.100.99' })),
    ).toThrow(CdnRequired);
  });
});

describe('SocketAddressResolver', () => {
  const resolver = new SocketAddressResolver();

  it('uses the socket address and ignores X-Forwarded-For', () => {
    expect(
      resolver.resolve(
        request({ 'x-forwarded-for': '198.51.100.99' }, '192.0.2.10'),
      ),
    ).toBe('192.0.2.10');
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(resolver.resolve(request({}, '::ffff:192.0.2.10'))).toBe(
      '192.0.2.10',
    );
  });

  it('returns "unknown" when the socket has no address', () => {
    expect(resolver.resolve(request({}))).toBe('unknown');
  });
});

describe('createClientIpResolver', () => {
  it('maps the configured source to its implementation', () => {
    expect(createClientIpResolver('cloudfront')).toBeInstanceOf(
      CloudFrontViewerAddressResolver,
    );
    expect(createClientIpResolver('socket')).toBeInstanceOf(
      SocketAddressResolver,
    );
  });
});
