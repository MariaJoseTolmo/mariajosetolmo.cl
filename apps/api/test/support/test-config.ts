import { loadConfig, type AppConfig } from '../../src/config/app-config';

export const TEST_ENV = {
  ALLOWED_ORIGINS: 'https://app.example.test',
  COOKIE_SECURE: 'true',
  CLIENT_IP_SOURCE: 'socket',
  SECRETS_SOURCE: 'env',
  JWT_ISSUER: 'https://issuer.example.test',
  MAGIC_LINK_BASE_URL: 'https://app.example.test/acceso/verificar/',
  MAIL_TRANSPORT: 'smtp',
  MAIL_FROM: 'no-reply@example.test',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
} as const;

/** A valid AppConfig built through the real loader, with optional overrides. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...loadConfig(TEST_ENV), ...overrides };
}
