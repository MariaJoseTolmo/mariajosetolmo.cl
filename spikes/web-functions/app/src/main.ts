import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ProbeController } from './probe.controller';

@Module({ controllers: [ProbeController] })
class AppModule {}

async function bootstrap(): Promise<void> {
  // Lambda sets AWS_LAMBDA_HTTP_ENDPOINT as "host:port"; it is unset locally.
  const raw = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
  console.log(`AWS_LAMBDA_HTTP_ENDPOINT=${raw ?? '(unset)'}`);
  const [host, port] = (raw || 'localhost:3000').split(':');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  await app.listen(Number(port), host);
  console.log(`listening on ${host}:${port}`);
}

void bootstrap();
