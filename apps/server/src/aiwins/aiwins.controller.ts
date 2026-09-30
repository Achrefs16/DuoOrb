import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AiwinsService, SubmitAiWinBody } from './aiwins.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';

@Controller('api')
export class AiwinsController {
  constructor(private readonly aiwinsService: AiwinsService) {}

  /**
   * Records a verified hard-AI win. Retries and offline replays carry the
   * same clientWinId and resolve to the stored row without double-counting.
   */
  @Post('ai-wins')
  @UseGuards(JwtAuthGuard)
  async submitAiWin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubmitAiWinBody
  ) {
    return this.aiwinsService.submitAiWin(user.id, body);
  }

  /** Own wins newest-first, without notation — the browse list. */
  @Get('ai-wins/mine')
  @UseGuards(JwtAuthGuard)
  async getMyWins(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const l = limit ? parseInt(limit, 10) : 20;
    const o = offset ? parseInt(offset, 10) : 0;
    return this.aiwinsService.getMyWins(user.id, l, o);
  }

  /** Full record including notation, owner only — the analysis view. */
  @Get('ai-wins/:id')
  @UseGuards(JwtAuthGuard)
  async getWinDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string
  ) {
    return this.aiwinsService.getWinDetail(user.id, id);
  }

  /** Earned badges, equipped slots, and the catalog with earned flags. */
  @Get('achievements/me')
  @UseGuards(JwtAuthGuard)
  async getMyAchievements(@CurrentUser() user: AuthenticatedUser) {
    return this.aiwinsService.getMyAchievements(user.id);
  }

  /** Sets the three profile showcase slots. */
  @Patch('me/badges')
  @UseGuards(JwtAuthGuard)
  async setBadges(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { slots?: (string | null)[] }
  ) {
    return this.aiwinsService.setBadges(user.id, body?.slots ?? []);
  }
}
