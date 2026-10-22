import { emailRateLimitKey, ipRateLimitKey } from './rate-limit-key';

const RULE = { limit: 10, windowSeconds: 900 };

describe('ipRateLimitKey', () => {
  it('keeps an IPv4 address whole', () => {
    expect(ipRateLimitKey('ml:ip', '203.0.113.7', RULE)).toEqual({
      scope: 'ml:ip',
      subject: '203.0.113.7',
      limit: 10,
      windowSeconds: 900,
    });
  });

  it('groups IPv6 addresses by their /64 prefix', () => {
    const a = ipRateLimitKey('ml:ip', '2001:db8:aaaa:bbbb:1:2:3:4', RULE);
    const b = ipRateLimitKey('ml:ip', '2001:db8:aaaa:bbbb:ffff::9', RULE);
    expect(a.subject).toBe('2001:db8:aaaa:bbbb::/64');
    expect(b.subject).toBe(a.subject);
  });

  it('keeps different /64 prefixes apart', () => {
    const a = ipRateLimitKey('ml:ip', '2001:db8:aaaa:bbbb::1', RULE);
    const b = ipRateLimitKey('ml:ip', '2001:db8:aaaa:bbbc::1', RULE);
    expect(a.subject).not.toBe(b.subject);
  });

  it.each([
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['2001:0DB8:0000:0001::', '2001:db8:0:1::/64'],
    ['::1', '0:0:0:0::/64'],
    ['::', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['64:ff9b::192.0.2.1', '64:ff9b:0:0::/64'],
    ['1:2:3:4:5:6:7:8', '1:2:3:4::/64'],
  ])('normalises %s to %s', (ip, subject) => {
    expect(ipRateLimitKey('ml:ip', ip, RULE).subject).toBe(subject);
  });

  it('leaves a non-address (the socket resolver fallback) untouched', () => {
    expect(ipRateLimitKey('vf:ip', 'unknown', RULE).subject).toBe('unknown');
  });

  it('carries the scope and the rule it was given', () => {
    expect(
      ipRateLimitKey('rf:ip', '203.0.113.7', { limit: 60, windowSeconds: 30 }),
    ).toMatchObject({ scope: 'rf:ip', limit: 60, windowSeconds: 30 });
  });
});

describe('emailRateLimitKey', () => {
  it('uses the normalised email as the subject', () => {
    expect(
      emailRateLimitKey('a@example.test', { limit: 3, windowSeconds: 900 }),
    ).toEqual({
      scope: 'ml:em',
      subject: 'a@example.test',
      limit: 3,
      windowSeconds: 900,
    });
  });
});
