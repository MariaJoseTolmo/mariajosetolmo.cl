import { ConfigError, loadConfig } from './app-config';

const BASE_ENV = {
  ALLOWED_ORIGINS: 'https://app.example.test',
  JWT_ISSUER: 'https://issuer.example.test',
  MAGIC_LINK_BASE_URL: 'https://app.example.test/acceso/verificar/',
  MAIL_FROM: 'no-reply@example.test',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
};

describe('loadConfig', () => {
  it('parses a minimal environment and applies safe defaults', () => {
    const config = loadConfig(BASE_ENV);
    expect(config).toEqual({
      allowedOrigins: ['https://app.example.test'],
      cookieSecure: true,
      clientIpSource: 'cloudfront',
      secretsSource: 'env',
      ssmPrefix: null,
      awsRegion: null,
      jwtIssuer: 'https://issuer.example.test',
      jwtAudience: 'web_cv-api',
      magicLinkBaseUrl: 'https://app.example.test/acceso/verificar/',
      mail: {
        transport: 'smtp',
        from: 'no-reply@example.test',
        smtpHost: '127.0.0.1',
        smtpPort: 1025,
      },
      rateLimits: {
        magicLinkIp: { limit: 10, windowSeconds: 900 },
        magicLinkEmail: { limit: 3, windowSeconds: 900 },
        verifyIp: { limit: 20, windowSeconds: 900 },
        refreshIp: { limit: 60, windowSeconds: 900 },
      },
    });
  });

  it('splits, trims and de-duplicates a list of allowed origins', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ALLOWED_ORIGINS:
        ' https://a.example.test , https://b.example.test,https://a.example.test ',
    });
    expect(config.allowedOrigins).toEqual([
      'https://a.example.test',
      'https://b.example.test',
    ]);
  });

  it('keeps Secure cookies unless COOKIE_SECURE is exactly "false"', () => {
    expect(
      loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'false' }).cookieSecure,
    ).toBe(false);
    expect(
      loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'true' }).cookieSecure,
    ).toBe(true);
    expect(
      loadConfig({ ...BASE_ENV, COOKIE_SECURE: 'nope' }).cookieSecure,
    ).toBe(true);
  });

  it('merges partial RATE_LIMITS overrides over the defaults', () => {
    const config = loadConfig({
      ...BASE_ENV,
      RATE_LIMITS: JSON.stringify({
        magicLinkIp: { limit: 2, windowSeconds: 60 },
      }),
    });
    expect(config.rateLimits.magicLinkIp).toEqual({
      limit: 2,
      windowSeconds: 60,
    });
    expect(config.rateLimits.refreshIp).toEqual({
      limit: 60,
      windowSeconds: 900,
    });
  });

  it.each([
    ['ALLOWED_ORIGINS', ''],
    ['JWT_ISSUER', ''],
    ['MAGIC_LINK_BASE_URL', 'not a url'],
    ['MAIL_FROM', ''],
    ['CLIENT_IP_SOURCE', 'forwarded'],
    ['SMTP_PORT', 'abc'],
    ['RATE_LIMITS', '{not json'],
    ['RATE_LIMITS', '{"magicLinkIp":{"limit":0,"windowSeconds":60}}'],
    ['RATE_LIMITS', '{"unknown":{"limit":1,"windowSeconds":60}}'],
  ])('fails fast naming %s when its value is %j', (key, value) => {
    expect(() => loadConfig({ ...BASE_ENV, [key]: value })).toThrow(
      new RegExp(key),
    );
  });

  it('fails fast when ALLOWED_ORIGINS is missing, with a ConfigError', () => {
    expect(() =>
      loadConfig({ ...BASE_ENV, ALLOWED_ORIGINS: undefined }),
    ).toThrow(ConfigError);
  });

  it('requires SSM_PREFIX when secrets come from SSM, and reads it', () => {
    expect(() => loadConfig({ ...BASE_ENV, SECRETS_SOURCE: 'ssm' })).toThrow(
      /SSM_PREFIX/,
    );
    const config = loadConfig({
      ...BASE_ENV,
      SECRETS_SOURCE: 'ssm',
      SSM_PREFIX: '/example/prod',
      AWS_REGION: 'us-east-1',
    });
    expect(config.secretsSource).toBe('ssm');
    expect(config.ssmPrefix).toBe('/example/prod');
    expect(config.awsRegion).toBe('us-east-1');
  });

  it('requires SMTP settings for the smtp transport but not for ses', () => {
    const noSmtp = { ...BASE_ENV, SMTP_HOST: undefined, SMTP_PORT: undefined };
    expect(() => loadConfig(noSmtp)).toThrow(/SMTP_HOST/);
    const config = loadConfig({ ...noSmtp, MAIL_TRANSPORT: 'ses' });
    expect(config.mail).toEqual({
      transport: 'ses',
      from: 'no-reply@example.test',
    });
  });

  describe('ALLOWED_ORIGINS entries', () => {
    it.each([
      'https://app.example.test/',
      'https://*.example.test',
      'app.example.test',
      'https://app.example.test/path',
      'https://APP.example.test',
      '*',
    ])('rejects %j (must equal its own origin)', (origin) => {
      expect(() =>
        loadConfig({ ...BASE_ENV, ALLOWED_ORIGINS: origin }),
      ).toThrow(/ALLOWED_ORIGINS/);
    });

    it('rejects the list if any single entry is bad', () => {
      expect(() =>
        loadConfig({
          ...BASE_ENV,
          ALLOWED_ORIGINS: 'https://a.example.test,https://b.example.test/',
        }),
      ).toThrow(/ALLOWED_ORIGINS/);
    });

    it('accepts origins with explicit ports', () => {
      expect(
        loadConfig({ ...BASE_ENV, ALLOWED_ORIGINS: 'http://127.0.0.1:3001' })
          .allowedOrigins,
      ).toEqual(['http://127.0.0.1:3001']);
    });
  });

  describe('production marker (SECRETS_SOURCE=ssm)', () => {
    const prod = {
      ...BASE_ENV,
      SECRETS_SOURCE: 'ssm',
      SSM_PREFIX: '/example/prod',
    };

    it('rejects CLIENT_IP_SOURCE=socket', () => {
      expect(() => loadConfig({ ...prod, CLIENT_IP_SOURCE: 'socket' })).toThrow(
        /CLIENT_IP_SOURCE/,
      );
    });

    it('rejects COOKIE_SECURE=false', () => {
      expect(() => loadConfig({ ...prod, COOKIE_SECURE: 'false' })).toThrow(
        /COOKIE_SECURE/,
      );
    });

    it('accepts the safe production combination', () => {
      const config = loadConfig({ ...prod, CLIENT_IP_SOURCE: 'cloudfront' });
      expect(config.cookieSecure).toBe(true);
      expect(config.clientIpSource).toBe('cloudfront');
    });

    it('still allows socket and insecure cookies with env secrets (local)', () => {
      const config = loadConfig({
        ...BASE_ENV,
        CLIENT_IP_SOURCE: 'socket',
        COOKIE_SECURE: 'false',
      });
      expect(config.clientIpSource).toBe('socket');
      expect(config.cookieSecure).toBe(false);
    });
  });
});
