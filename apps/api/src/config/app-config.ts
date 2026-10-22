export const APP_CONFIG = Symbol('APP_CONFIG');

export type Env = Readonly<Record<string, string | undefined>>;

export type ClientIpSource = 'cloudfront' | 'socket';
export type SecretsSource = 'env' | 'ssm';

export interface RateLimitRule {
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimits {
  readonly magicLinkIp: RateLimitRule;
  readonly magicLinkEmail: RateLimitRule;
  readonly verifyIp: RateLimitRule;
  readonly refreshIp: RateLimitRule;
}

export type MailConfig =
  | {
      readonly transport: 'smtp';
      readonly from: string;
      readonly smtpHost: string;
      readonly smtpPort: number;
    }
  | { readonly transport: 'ses'; readonly from: string };

export interface AppConfig {
  readonly allowedOrigins: readonly string[];
  readonly cookieSecure: boolean;
  readonly clientIpSource: ClientIpSource;
  readonly secretsSource: SecretsSource;
  readonly ssmPrefix: string | null;
  readonly awsRegion: string | null;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly magicLinkBaseUrl: string;
  readonly mail: MailConfig;
  readonly rateLimits: RateLimits;
}

export class ConfigError extends Error {
  constructor(key: string, problem: string) {
    super(`Invalid configuration: ${key} ${problem}`);
    this.name = 'ConfigError';
  }
}

const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_JWT_AUDIENCE = 'web_cv-api';

const DEFAULT_RATE_LIMITS: RateLimits = {
  magicLinkIp: { limit: 10, windowSeconds: DEFAULT_WINDOW_SECONDS },
  magicLinkEmail: { limit: 3, windowSeconds: DEFAULT_WINDOW_SECONDS },
  verifyIp: { limit: 20, windowSeconds: DEFAULT_WINDOW_SECONDS },
  refreshIp: { limit: 60, windowSeconds: DEFAULT_WINDOW_SECONDS },
};

function required(env: Env, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new ConfigError(key, 'is required');
  return value;
}

function optional(env: Env, key: string): string | null {
  return env[key]?.trim() || null;
}

function oneOf<T extends string>(
  env: Env,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = optional(env, key) ?? fallback;
  const match = allowed.find((candidate) => candidate === value);
  if (!match) {
    throw new ConfigError(key, `must be one of: ${allowed.join(', ')}`);
  }
  return match;
}

function parseOrigins(env: Env): string[] {
  const origins = required(env, 'ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  for (const origin of origins) {
    if (
      origin.includes('*') ||
      !URL.canParse(origin) ||
      new URL(origin).origin !== origin
    ) {
      throw new ConfigError(
        'ALLOWED_ORIGINS',
        `entry "${origin}" must be an exact origin (scheme://host[:port], no path or wildcard)`,
      );
    }
  }
  return [...new Set(origins)];
}

function parseUrl(env: Env, key: string): string {
  const value = required(env, key);
  if (!URL.canParse(value)) throw new ConfigError(key, 'must be a valid URL');
  return value;
}

function parsePort(env: Env, key: string): number {
  const value = Number(required(env, key));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ConfigError(key, 'must be a TCP port');
  }
  return value;
}

function parseMail(env: Env): MailConfig {
  const transport = oneOf(env, 'MAIL_TRANSPORT', ['smtp', 'ses'], 'smtp');
  const from = required(env, 'MAIL_FROM');
  if (transport === 'ses') return { transport, from };
  return {
    transport,
    from,
    smtpHost: required(env, 'SMTP_HOST'),
    smtpPort: parsePort(env, 'SMTP_PORT'),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parseRateLimits(env: Env): RateLimits {
  const raw = optional(env, 'RATE_LIMITS');
  if (raw === null) return DEFAULT_RATE_LIMITS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError('RATE_LIMITS', 'must be valid JSON');
  }
  if (!isPlainObject(parsed)) {
    throw new ConfigError('RATE_LIMITS', 'must be a JSON object');
  }
  const merged: Record<string, RateLimitRule> = { ...DEFAULT_RATE_LIMITS };
  for (const [name, rule] of Object.entries(parsed)) {
    if (!(name in DEFAULT_RATE_LIMITS)) {
      throw new ConfigError('RATE_LIMITS', `has an unknown rule "${name}"`);
    }
    if (
      !isPlainObject(rule) ||
      !isPositiveInt(rule['limit']) ||
      !isPositiveInt(rule['windowSeconds'])
    ) {
      throw new ConfigError(
        'RATE_LIMITS',
        `rule "${name}" needs positive integer limit and windowSeconds`,
      );
    }
    merged[name] = {
      limit: rule['limit'],
      windowSeconds: rule['windowSeconds'],
    };
  }
  return merged as unknown as RateLimits;
}

/** Pure and fail-fast: reads no globals, so it is testable with a plain object. */
export function loadConfig(env: Env): AppConfig {
  const secretsSource = oneOf(env, 'SECRETS_SOURCE', ['env', 'ssm'], 'env');
  // Secure unless explicitly disabled for plain-HTTP local development.
  const cookieSecure = env['COOKIE_SECURE']?.trim() !== 'false';
  const clientIpSource = oneOf(
    env,
    'CLIENT_IP_SOURCE',
    ['cloudfront', 'socket'],
    'cloudfront',
  );
  // SSM secrets mark a deployed environment: local-only escapes are refused.
  if (secretsSource === 'ssm') {
    if (clientIpSource === 'socket') {
      throw new ConfigError(
        'CLIENT_IP_SOURCE',
        'must not be "socket" when SECRETS_SOURCE=ssm',
      );
    }
    if (!cookieSecure) {
      throw new ConfigError(
        'COOKIE_SECURE',
        'must not be "false" when SECRETS_SOURCE=ssm',
      );
    }
  }
  return {
    allowedOrigins: parseOrigins(env),
    cookieSecure,
    clientIpSource,
    secretsSource,
    ssmPrefix: secretsSource === 'ssm' ? required(env, 'SSM_PREFIX') : null,
    awsRegion: optional(env, 'AWS_REGION'),
    jwtIssuer: required(env, 'JWT_ISSUER'),
    jwtAudience: DEFAULT_JWT_AUDIENCE,
    magicLinkBaseUrl: parseUrl(env, 'MAGIC_LINK_BASE_URL'),
    mail: parseMail(env),
    rateLimits: parseRateLimits(env),
  };
}
