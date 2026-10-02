import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { Glicko2Service } from './glicko2.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [RatingsController],
  providers: [RatingsService, Glicko2Service],
  exports: [RatingsService, Glicko2Service],
})
export class RatingModule {}
