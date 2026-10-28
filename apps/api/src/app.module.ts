import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { ContentModule } from './content/content.module';
import { CvModule } from './cv/cv.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { SharedModule } from './shared/infrastructure/shared.module';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
    AuthModule,
    IdentityModule,
    AdminModule,
    CvModule,
    ContentModule,
    HealthModule,
  ],
})
export class AppModule {}
