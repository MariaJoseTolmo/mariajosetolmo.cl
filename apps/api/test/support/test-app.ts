import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap/configure-app';
import { CLOCK } from '../../src/shared/application/ports/clock.port';
import { SECRETS_PROVIDER, type Secrets } from '../../src/config/secrets.port';
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
    databaseUrl: null,
    redisUrl: null,
    ...options.secrets,
  };
  let builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  })
    .overrideProvider(SECRETS_PROVIDER)
    .useValue({ load: () => Promise.resolve(secrets) })
    .overrideProvider(CLOCK)
    .useValue(clock);
  if (options.customize) builder = options.customize(builder);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const users = app.get<InMemoryUserRepository>(USER_REPOSITORY);
  const issuer = app.get<AccessTokenIssuer>(ACCESS_TOKEN_ISSUER);
  const accessCookie = cookieNamesFor(true).access;
  return {
    app,
    clock,
    secrets,
    users,
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
