import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.enableCors({
    origin: '*',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[DuoOrb Server] Authoritative game backend listening on port ${port}`);
}

bootstrap();
