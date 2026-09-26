import { Global, Module } from '@nestjs/common';
import { GuestService } from './guest.service.js';
import { GuestController } from './guest.controller.js';
import { RateLimiter } from './rate-limiter.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Global because the auth service and the socket gateway both need
 * `verifyAccessToken` synchronously on the handshake path.
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [GuestController],
  providers: [GuestService, RateLimiter],
  exports: [GuestService, RateLimiter],
})
export class GuestModule {}
