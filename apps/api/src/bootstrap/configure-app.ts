import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { DomainExceptionFilter } from '../shared/infrastructure/http/domain-exception.filter';
import { noStore } from './no-store';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(noStore);
  app.useGlobalFilters(new DomainExceptionFilter());
  const config = new DocumentBuilder()
    .setTitle('web_cv API')
    // Names only: the docs never carry example cookie or token values.
    .addCookieAuth('__Host-access', undefined, 'access-cookie')
    .build();
  // Always on, production included; /admin routes are excluded from the document.
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
  return app;
}
