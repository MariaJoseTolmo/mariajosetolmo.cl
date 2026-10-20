import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder().setTitle('web_cv API').build();
  // Always on, production included; /admin routes get excluded with the auth change.
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
  return app;
}
