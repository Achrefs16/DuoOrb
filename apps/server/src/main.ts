import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { resolveCorsOrigins } from './config/cors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  // Explicit allowlist, shared with the WebSocket gateway. Native builds are
  // unaffected (CORS is browser-enforced); this exists to stop arbitrary
  // websites from calling the API. See config/cors.ts.
  app.enableCors({ origin: resolveCorsOrigins() });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[DuoOrb Server] Authoritative game backend listening on port ${port}`);
}

bootstrap();
