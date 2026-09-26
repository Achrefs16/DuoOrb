import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { resolveCorsOrigins } from './config/cors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  // One proxy hop (Caddy) sits in front of this server and overwrites
  // X-Forwarded-For, so trust exactly one hop: without this every client
  // shares one rate-limit bucket and @Ip() sees only the proxy.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // Explicit allowlist, shared with the WebSocket gateway. Native builds are
  // unaffected (CORS is browser-enforced); this exists to stop arbitrary
  // websites from calling the API. See config/cors.ts.
  app.enableCors({ origin: resolveCorsOrigins() });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[DuoOrb Server] Authoritative game backend listening on port ${port}`);
}

bootstrap();
