import { config as loadEnv } from 'dotenv';
// Must run before any other local import (ConfigModule.forRoot() refuses to
// let .env override a variable that's already present in process.env, so a
// stale OPENAI_API_KEY etc. leaking in from the parent shell would otherwise
// silently win over the correct value in apps/backend/.env).
loadEnv({ override: true });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false — Nest's built-in parser (100kb limit) registers itself before any
  // app.use() call below could run, so a second, bigger-limit parser would never get to see
  // the request body. Disabling it and installing our own is the only way to raise the limit.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.use(cookieParser());
  // Base64 photo uploads (business card scan, quotation attachments) are several MB — well
  // past Express's 100kb default.
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3005',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HPL Maker — Business Owner Command Center API')
    .setDescription('Phase 1 REST API')
    .setVersion('0.1')
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<string>('PORT') ?? '4000';
  await app.listen(port);
}
bootstrap();
