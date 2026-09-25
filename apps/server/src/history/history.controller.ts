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
    const l = limit ? parseInt(limit, 10) : 20;
    const o = offset ? parseInt(offset, 10) : 0;
    return this.historyService.getUserHistory(user.id, l, o);
  }

  @Get('user/:userId/history')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const l = limit ? parseInt(limit, 10) : 20;
    const o = offset ? parseInt(offset, 10) : 0;
    return this.historyService.getUserHistory(userId, l, o);
  }

  @Get(':gameId')
  async getGameReplay(@Param('gameId') gameId: string) {
    return this.historyService.getGameReplay(gameId);
  }
}
