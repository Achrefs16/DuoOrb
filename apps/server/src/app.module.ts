import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GuestModule } from './guest/guest.module.js';
import { UsersModule } from './users/users.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { HistoryModule } from './history/history.module.js';
import { RatingModule } from './rating/rating.module.js';
import { AiwinsModule } from './aiwins/aiwins.module.js';
import { LegalModule } from './legal/legal.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { GameGateway } from './gateway/game.gateway.js';

@Module({
  imports: [
    DatabaseModule,
    // Abuse guardrail: 100 req/min per client across all HTTP routes. Game
    // traffic rides the socket (untouched by this guard); sparse REST calls
    // never approach the limit on happy paths.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    // Global: the socket gateway resolves guest tokens on its handshake path.
    GuestModule,
    UsersModule,
    FriendsModule,
    HistoryModule,
    RatingModule,
    AiwinsModule,
    LegalModule,
    ReportsModule,
  ],
  providers: [GameGateway, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
