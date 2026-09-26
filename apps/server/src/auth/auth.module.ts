import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { GuestTokenService } from './guest-token.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [AuthService, JwtAuthGuard, GuestTokenService],
  // GuestTokenService is exported so the guest module can sign credentials
  // without depending on AuthService (which would be a cycle).
  exports: [AuthService, JwtAuthGuard, GuestTokenService],
})
export class AuthModule {}
