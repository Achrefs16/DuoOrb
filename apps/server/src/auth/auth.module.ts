import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { GuestTokenService } from './guest-token.service.js';
import { ReviewerTokenService } from './reviewer-token.service.js';
import { AuthController } from './auth.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, GuestTokenService, ReviewerTokenService],
  // GuestTokenService and ReviewerTokenService are exported so other modules
  // can sign/verify tokens without circular dependencies.
  exports: [AuthService, JwtAuthGuard, GuestTokenService, ReviewerTokenService],
})
export class AuthModule {}
