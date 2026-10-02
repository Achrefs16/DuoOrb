import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HistoryService } from './history.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';
import { clampLimit, clampOffset } from '../common/pagination.js';

@Controller('api/games')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getMyHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.historyService.getUserHistory(
      user.id,
      clampLimit(limit, 20, 50),
      clampOffset(offset)
    );
  }

  @Get('user/:userId/history')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.historyService.getUserHistory(
      userId,
      clampLimit(limit, 20, 50),
      clampOffset(offset)
    );
  }

  @Get(':gameId')
  async getGameReplay(@Param('gameId') gameId: string) {
    return this.historyService.getGameReplay(gameId);
  }
}
