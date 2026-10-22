import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { APP_SECRETS, type Secrets } from '../config/secrets.port';
import {
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_VERIFIER,
  JWKS_PROVIDER,
} from './application/ports/access-token.port';
import { JwtAuthGuard } from './infrastructure/http/guards/jwt-auth.guard';
import { OriginGuard } from './infrastructure/http/guards/origin.guard';
import { RolesGuard } from './infrastructure/http/guards/roles.guard';
import { JwksController } from './infrastructure/http/jwks.controller';
import { JoseAccessTokenService } from './infrastructure/jose/jose-access-token.service';

const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');

@Module({
  controllers: [JwksController],
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
