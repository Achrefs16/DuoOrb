import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { resolveCorsOrigins } from './config/cors.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

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
  // Security headers. Three defaults are OFF on purpose: the stock
  // Content-Security-Policy (`connect-src 'self'`) and the same-origin
  // resource/opener policies would make browsers refuse the web build's
  // cross-origin API fetch and socket handshake — the exact clients CORS
  // explicitly allows. Everything else (HSTS, nosniff, referrer…) stays on.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
  // Contract shape for every error body (see common/http-exception.filter.ts).
  // whitelist strips unknown DTO props; forbidNonWhitelisted stays off so
  // extra fields warn nothing and break nothing on happy paths.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true })
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[DuoOrb Server] Authoritative game backend listening on port ${port}`);
}

bootstrap();
