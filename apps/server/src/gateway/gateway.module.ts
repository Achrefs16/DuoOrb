import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { GuestModule } from '../guest/guest.module.js';

@Module({
  imports: [AuthModule, DatabaseModule, GuestModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GatewayModule {}
