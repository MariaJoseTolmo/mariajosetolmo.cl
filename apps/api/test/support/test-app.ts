import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { CLOCK } from '../../src/shared/application/ports/clock.port';
import { APP_CONFIG, type AppConfig } from '../../src/config/app-config';
import { SECRETS_PROVIDER, type Secrets } from '../../src/config/secrets.port';
import {
  MAGIC_LINK_STORE,
  type MagicLinkStore,
} from '../../src/auth/application/ports/magic-link-store.port';
import { MAIL_SENDER } from '../../src/auth/application/ports/mail-sender.port';
import {
  RATE_LIMITER,
  type RateLimiter,
} from '../../src/auth/application/ports/rate-limiter.port';
import { InMemoryMagicLinkStore } from '../../src/auth/infrastructure/in-memory/in-memory-magic-link.store';
import { InMemoryRateLimiter } from '../../src/auth/infrastructure/in-memory/in-memory-rate-limiter';
import { REFRESH_TOKEN_REPOSITORY } from '../../src/auth/application/ports/refresh-token-repository.port';
import { InMemoryRefreshTokenRepository } from '../../src/auth/infrastructure/in-memory/in-memory-refresh-token.repository';
import { DATA_SOURCE } from '../../src/shared/infrastructure/persistence/data-source.factory';
import { LOGGER } from '../../src/shared/application/ports/logger.port';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis/redis-client.factory';
import { CapturingLogger } from './fakes/capturing-logger';
import { CapturingMailSender } from './fakes/capturing-mail-sender';
import { testConfig } from './test-config';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '../../src/auth/application/ports/access-token.port';
import { cookieNamesFor } from '../../src/auth/infrastructure/http/cookie-names';
import { AVAILABILITY_REPOSITORY } from '../../src/availability/application/ports/availability-repository.port';
import { Email } from '../../src/identity/domain/email';
import type { Role } from '../../src/identity/domain/role';
import { USER_REPOSITORY } from '../../src/identity/application/ports/user-repository.port';
import { FakeClock } from './fakes/fake-clock';
import {
  InMemoryAvailabilityRepository,
  InMemoryUserRepository,
} from './fakes/in-memory-repositories';
import { testKeyPair } from './keys';

export const TEST_KEY_ID = 'test-kid-1';
export const TEST_ADMIN_EMAIL = 'admin@example.test';

export interface TestUser {
  readonly id?: string;
  readonly email?: string;
  readonly role?: Role;
  readonly company?: string | null;
  readonly name?: string | null;
}

export interface TestApp {
  readonly app: INestApplication;
  readonly clock: FakeClock;
  readonly secrets: Secrets;
  readonly users: InMemoryUserRepository;
  readonly availability: InMemoryAvailabilityRepository;
  readonly refresh: InMemoryRefreshTokenRepository;
  readonly mail: CapturingMailSender;
  readonly logger: CapturingLogger;
  /** The in-memory store; the app uses it unless `options.store` replaces it. */
  readonly store: InMemoryMagicLinkStore;
  /** Seeds a user, issues an access token for them and returns a Cookie header. */
  login(user?: TestUser): Promise<string>;
  server(): App;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** Last-chance hook to override extra providers before compiling. */
  readonly customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
  readonly secrets?: Partial<Secrets>;
  /** Test-only controllers mounted next to the real modules. */
  readonly controllers?: Type[];
  /** Replaces the loaded configuration (built through the real loader). */
  readonly config?: Partial<AppConfig>;
  /** A rate limiter or store that misbehaves, for fail-closed scenarios. */
  readonly limiter?: RateLimiter;
  readonly store?: MagicLinkStore;
  /**
   * A stand-in DataSource. When given, the REAL user repository runs on top of
   * it (instead of the in-memory one), to exercise lazy initialisation.
   */
  readonly dataSource?: unknown;
}

/**
 * The single way e2e specs build the app: real modules and guards, with the
 * clock, secrets and (as slices land) stores replaced by in-memory fakes.
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const clock = new FakeClock();
  const secrets: Secrets = {
    jwtPrivateKeyPem: testKeyPair().privatePem,
    jwtKeyId: TEST_KEY_ID,
    jwtPreviousPublicKeyPem: null,
    jwtPreviousKeyId: null,
    adminEmail: TEST_ADMIN_EMAIL,
    databaseUrl: 'postgres://user:pw@127.0.0.1:5432/example',
    redisUrl: 'redis://127.0.0.1:6379',
    ...options.secrets,
  };
  const users = new InMemoryUserRepository();
  const refresh = new InMemoryRefreshTokenRepository();
  const mail = new CapturingMailSender();
  const logger = new CapturingLogger();
  const store = new InMemoryMagicLinkStore(clock);
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(SECRETS_PROVIDER)
    .useValue({ load: () => Promise.resolve(secrets) })
    .overrideProvider(CLOCK)
    .useValue(clock)
    // No e2e touches a real Redis or Postgres: stubs that never connect.
    .overrideProvider(REDIS_CLIENT)
    .useValue({ disconnect: () => undefined })
    .overrideProvider(DATA_SOURCE)
    .useValue(options.dataSource ?? { isInitialized: false })
    .overrideProvider(MAGIC_LINK_STORE)
    .useValue(options.store ?? store)
    .overrideProvider(RATE_LIMITER)
    .useValue(options.limiter ?? new InMemoryRateLimiter(clock))
    .overrideProvider(MAIL_SENDER)
    .useValue(mail)
    .overrideProvider(LOGGER)
    .useValue(logger);
  if (!options.dataSource) {
    builder = builder
      .overrideProvider(USER_REPOSITORY)
      .useValue(users)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(refresh);
  }
  if (options.config) {
    builder = builder
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig(options.config));
  }
  if (options.customize) builder = options.customize(builder);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const issuer = app.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);
  const accessCookie = cookieNamesFor(true).access;
  return {
    app,
    clock,
    secrets,
    users,
    refresh,
    mail,
    logger,
    store,
    availability: app.get<InMemoryAvailabilityRepository>(
      AVAILABILITY_REPOSITORY,
    ),
    async login(user: TestUser = {}) {
      const id = user.id ?? 'user-1';
      const role = user.role ?? 'RECRUITER';
      users.seed({
        id,
        email: Email.parse(user.email ?? 'recruiter@example.test'),
        role,
        company: user.company === undefined ? 'Acme' : user.company,
        name: user.name === undefined ? 'Ana' : user.name,
      });
      const jwt = await issuer.issue({ sub: id, role }, clock.now());
      return `${accessCookie}=${jwt}`;
    },
    server: () => app.getHttpServer() as App,
    close: () => app.close(),
  };
}
