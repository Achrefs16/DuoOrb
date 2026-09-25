import { Controller, Get, Param, Query } from '@nestjs/common';
import { RatingsService } from './ratings.service.js';

@Controller('api')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('leaderboard')
  async getLeaderboard(
    @Query('mode') mode?: string,
    @Query('limit') limit?: string
  ) {
    // mode is accepted for backward compatibility but ignored: one universal board.
    const l = limit ? parseInt(limit, 10) : 50;
    return this.ratingsService.getLeaderboard(mode || 'UNIVERSAL', l);
  }

  @Get('users/:userId/rating-history')
  async getRatingHistory(
    @Param('userId') userId: string,
    @Query('mode') mode?: string,
    @Query('limit') limit?: string
  ) {
    const l = limit ? parseInt(limit, 10) : 30;
    return this.ratingsService.getRatingHistory(userId, mode || 'UNIVERSAL', l);
  }
}
