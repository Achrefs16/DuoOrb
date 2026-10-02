import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';
import { clampLimit, clampOffset } from '../common/pagination.js';

@Controller('api')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('leaderboard')
  async getLeaderboard(
    @Query('mode') mode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    // mode is accepted for backward compatibility but ignored: one universal board.
    // The service clamps again; the edge clamp keeps garbage out of logs.
    return this.ratingsService.getLeaderboard(
      mode || 'UNIVERSAL',
      clampLimit(limit, 50, 50),
      clampOffset(offset)
    );
  }

  /**
   * Where the caller sits on the board, with a 50-row window around them.
   * Guests are not ranked: `{ ranked: false }`, never an error, so the
   * client shows the link card. Placed before any `:param` route.
   */
  @Get('leaderboard/me')
  @UseGuards(JwtAuthGuard)
  async getMyRank(@CurrentUser() user: AuthenticatedUser) {
    return this.ratingsService.getMyRank(user.id);
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
