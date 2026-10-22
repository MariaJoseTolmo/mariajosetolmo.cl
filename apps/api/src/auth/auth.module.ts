import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { APP_SECRETS, type Secrets } from '../config/secrets.port';
import {
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_VERIFIER,
  JWKS_PROVIDER,
} from './application/ports/access-token.port';
import { MAGIC_LINK_STORE } from './application/ports/magic-link-store.port';
import { MAIL_SENDER } from './application/ports/mail-sender.port';
import { RATE_LIMITER } from './application/ports/rate-limiter.port';
import {
  REQUEST_MAGIC_LINK_OPTIONS,
  RequestMagicLink,
} from './application/request-magic-link.use-case';
import { AuthController } from './infrastructure/http/auth.controller';
import {
  CLIENT_IP_RESOLVER,
  createClientIpResolver,
} from './infrastructure/http/client-ip.resolver';
import { createMailSender } from './infrastructure/mail/mail-sender.factory';
import { RedisMagicLinkStore } from './infrastructure/redis/redis-magic-link.store';
import { RedisRateLimiter } from './infrastructure/redis/redis-rate-limiter';
import { REDIS_CLIENT } from '../shared/infrastructure/redis/redis-client.factory';
import type { Redis } from 'ioredis';
import { IdentityModule } from '../identity/identity.module';
import { REFRESH_TOKEN_REPOSITORY } from './application/ports/refresh-token-repository.port';
import {
  VERIFY_MAGIC_LINK_OPTIONS,
  VerifyMagicLink,
} from './application/verify-magic-link.use-case';
import { InMemoryRefreshTokenRepository } from './infrastructure/in-memory/in-memory-refresh-token.repository';
import { SessionCookieWriter } from './infrastructure/http/session-cookie.writer';
import { JwtAuthGuard } from './infrastructure/http/guards/jwt-auth.guard';
import { OriginGuard } from './infrastructure/http/guards/origin.guard';
import { RolesGuard } from './infrastructure/http/guards/roles.guard';
import { JwksController } from './infrastructure/http/jwks.controller';
import { JoseAccessTokenService } from './infrastructure/jose/jose-access-token.service';

const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

@Module({
  imports: [IdentityModule],
  controllers: [AuthController, JwksController],
  providers: [
    {
      provide: ACCESS_TOKEN_SERVICE,
      useFactory: (config: AppConfig, secrets: Secrets) =>
        new JoseAccessTokenService({
          privateKeyPem: secrets.jwtPrivateKeyPem,
          keyId: secrets.jwtKeyId,
          previousPublicKeyPem: secrets.jwtPreviousPublicKeyPem,
          previousKeyId: secrets.jwtPreviousKeyId,
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }),
      inject: [APP_CONFIG, APP_SECRETS],
    },
    {
      provide: CLIENT_IP_RESOLVER,
      useFactory: (config: AppConfig) =>
        createClientIpResolver(config.clientIpSource),
      inject: [APP_CONFIG],
    },
    {
      provide: MAGIC_LINK_STORE,
      useFactory: (redis: Redis) => new RedisMagicLinkStore(redis),
      inject: [REDIS_CLIENT],
    },
    {
      provide: RATE_LIMITER,
      useFactory: (redis: Redis) => new RedisRateLimiter(redis),
      inject: [REDIS_CLIENT],
    },
    {
      provide: MAIL_SENDER,
      useFactory: (config: AppConfig) => createMailSender(config),
      inject: [APP_CONFIG],
    },
    {
      provide: REQUEST_MAGIC_LINK_OPTIONS,
      useFactory: (config: AppConfig) => ({
        baseUrl: config.magicLinkBaseUrl,
        ipRule: config.rateLimits.magicLinkIp,
        emailRule: config.rateLimits.magicLinkEmail,
      }),
      inject: [APP_CONFIG],
    },
    RequestMagicLink,
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      // In memory until the Postgres repository replaces it (U7).
      useFactory: () => new InMemoryRefreshTokenRepository(),
    },
    {
      provide: VERIFY_MAGIC_LINK_OPTIONS,
      useFactory: (config: AppConfig, secrets: Secrets) => ({
        adminEmail: secrets.adminEmail,
        ipRule: config.rateLimits.verifyIp,
      }),
      inject: [APP_CONFIG, APP_SECRETS],
    },
    VerifyMagicLink,
    {
      provide: SessionCookieWriter,
      useFactory: (config: AppConfig) =>
        new SessionCookieWriter(config.cookieSecure),
      inject: [APP_CONFIG],
    },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: ACCESS_TOKEN_SERVICE },
    { provide: ACCESS_TOKEN_VERIFIER, useExisting: ACCESS_TOKEN_SERVICE },
    { provide: JWKS_PROVIDER, useExisting: ACCESS_TOKEN_SERVICE },
    // Nest runs global guards in registration order: Origin, then JWT, then roles.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [ACCESS_TOKEN_ISSUER, ACCESS_TOKEN_VERIFIER],
})
export class AuthModule {}
