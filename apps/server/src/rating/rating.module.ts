import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { Glicko2Service } from './glicko2.service.js';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService, Glicko2Service],
  exports: [RatingsService, Glicko2Service],
})
export class RatingModule {}
