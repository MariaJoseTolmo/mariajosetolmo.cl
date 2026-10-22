import { isIPv6 } from 'node:net';

export type RateLimitScope = 'ml:ip' | 'ml:em' | 'vf:ip' | 'rf:ip';

export interface RateLimitKey {
  readonly scope: RateLimitScope;
  /** Normalised here; stores only ever hash it, never log it. */
  readonly subject: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

interface Rule {
  readonly limit: number;
  readonly windowSeconds: number;
}

const IPV6_GROUPS = 8;
const PREFIX_GROUPS = 4;
const HEX_BASE = 16;
const BYTE = 256;

/** `a.b.c.d` tail of an IPv6 text form, as its two 16-bit groups in hex. */
function dottedTailToGroups(address: string): string {
  const lastColon = address.lastIndexOf(':');
  const tail = address.slice(lastColon + 1);
  if (!tail.includes('.')) return address;
  const [a = 0, b = 0, c = 0, d = 0] = tail.split('.').map(Number);
  const high = (a * BYTE + b).toString(HEX_BASE);
  const low = (c * BYTE + d).toString(HEX_BASE);
  return `${address.slice(0, lastColon + 1)}${high}:${low}`;
}

function groupsOf(part: string): string[] {
  return part === '' ? [] : part.split(':');
}

/** The first 64 bits of an IPv6 address: one household, not one address. */
function ipv6Prefix64(address: string): string {
  const bare = dottedTailToGroups(address.split('%')[0] ?? address);
  const [head = '', tail] = bare.split('::');
  const headGroups = groupsOf(head);
  const tailGroups = tail === undefined ? [] : groupsOf(tail);
  const zeros = Array<string>(
    Math.max(0, IPV6_GROUPS - headGroups.length - tailGroups.length),
  ).fill('0');
  const prefix = [...headGroups, ...zeros, ...tailGroups]
    .slice(0, PREFIX_GROUPS)
    .map((group) => parseInt(group, HEX_BASE).toString(HEX_BASE));
  return `${prefix.join(':')}::/64`;
}

export function ipRateLimitKey(
  scope: 'ml:ip' | 'vf:ip' | 'rf:ip',
  ip: string,
  rule: Rule,
): RateLimitKey {
  const subject = isIPv6(ip) ? ipv6Prefix64(ip) : ip;
  return { scope, subject, ...rule };
}

export function emailRateLimitKey(email: string, rule: Rule): RateLimitKey {
  return { scope: 'ml:em', subject: email, ...rule };
}
