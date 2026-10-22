import { cookieNamesFor } from './cookie-names';
import { SessionCookieWriter, type HeaderSink } from './session-cookie.writer';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const secondsAfter = (seconds: number): Date =>
  new Date(NOW.getTime() + seconds * 1000);

class CapturingResponse implements HeaderSink {
  readonly setCookie: string[] = [];

  append(name: string, value: string): void {
    if (name.toLowerCase() === 'set-cookie') this.setCookie.push(value);
  }
}

const session = {
  accessJwt: 'aaa.bbb.ccc',
  refreshToken: 'r'.repeat(43),
  refreshExpiresAt: new Date('2026-01-08T00:00:00.000Z'),
};

function attributes(header: string): string[] {
  return header.split('; ').slice(1);
}

describe('cookieNamesFor', () => {
  it('uses the __Host-/__Secure- prefixes when Secure is on', () => {
    expect(cookieNamesFor(true)).toEqual({
      access: '__Host-access',
      refresh: '__Secure-refresh',
    });
  });

  it('drops the prefixes when Secure is off (they require Secure)', () => {
    expect(cookieNamesFor(false)).toEqual({
      access: 'access',
      refresh: 'refresh',
    });
  });
});

describe('SessionCookieWriter', () => {
  describe('write', () => {
    it('emits the access cookie with the exact required attributes', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(true).write(res, session, NOW);
      const access = res.setCookie.find((c) => c.startsWith('__Host-access='));
      expect(access?.split('; ')[0]).toBe('__Host-access=aaa.bbb.ccc');
      expect(attributes(access!)).toEqual([
        'Path=/',
        'Max-Age=900',
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
      ]);
      expect(access).not.toMatch(/Domain/i);
    });

    it('emits the refresh cookie scoped to /api/auth with the full session Max-Age', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(true).write(res, session, NOW);
      const refresh = res.setCookie.find((c) =>
        c.startsWith('__Secure-refresh='),
      );
      expect(refresh?.split('; ')[0]).toBe(
        `__Secure-refresh=${'r'.repeat(43)}`,
      );
      expect(attributes(refresh!)).toEqual([
        'Path=/api/auth',
        'Max-Age=604800',
        'HttpOnly',
        'Secure',
        'SameSite=Strict',
      ]);
    });

    it('uses the remaining family time for the refresh Max-Age after rotation', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(true).write(res, session, secondsAfter(86400));
      const refresh = res.setCookie.find((c) =>
        c.startsWith('__Secure-refresh='),
      );
      expect(attributes(refresh!)).toContain('Max-Age=518400');
    });

    it('writes two separate Set-Cookie headers', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(true).write(res, session, NOW);
      expect(res.setCookie).toHaveLength(2);
    });

    it('omits Secure and the prefixes when COOKIE_SECURE=false', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(false).write(res, session, NOW);
      expect(res.setCookie).toHaveLength(2);
      expect(res.setCookie[0]).toMatch(/^access=aaa\.bbb\.ccc; /);
      expect(res.setCookie[1]).toMatch(/^refresh=/);
      for (const header of res.setCookie) {
        expect(attributes(header)).not.toContain('Secure');
        expect(attributes(header)).toContain('HttpOnly');
        expect(attributes(header)).toContain('SameSite=Strict');
      }
    });

    it('refuses values that could inject cookie attributes or headers', () => {
      const writer = new SessionCookieWriter(true);
      expect(() =>
        writer.write(
          new CapturingResponse(),
          { ...session, accessJwt: 'x; Domain=evil.example.test' },
          NOW,
        ),
      ).toThrow('Invalid cookie value');
      expect(() =>
        writer.write(
          new CapturingResponse(),
          { ...session, refreshToken: 'a\r\nSet-Cookie: b=c' },
          NOW,
        ),
      ).toThrow('Invalid cookie value');
    });
  });

  describe('clear', () => {
    it('expires both cookies with Max-Age=0 on the same paths', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(true).clear(res);
      expect(res.setCookie).toHaveLength(2);
      expect(res.setCookie[0]).toBe(
        '__Host-access=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
      );
      expect(res.setCookie[1]).toBe(
        '__Secure-refresh=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
      );
    });

    it('clears the unprefixed names without Secure in insecure mode', () => {
      const res = new CapturingResponse();
      new SessionCookieWriter(false).clear(res);
      expect(res.setCookie).toEqual([
        'access=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict',
        'refresh=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict',
      ]);
    });
  });
});
