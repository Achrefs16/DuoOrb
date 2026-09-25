import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { HistoryModule } from './history/history.module.js';
import { RatingModule } from './rating/rating.module.js';
import { GameGateway } from './gateway/game.gateway.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    HistoryModule,
    RatingModule,
  ],
  providers: [GameGateway],
})
export class AppModule {}
