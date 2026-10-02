import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/auth.service.js';
import { REPORT_REASONS, ReportsService } from './reports.service.js';

@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reasons')
  reasons() {
    return { reasons: REPORT_REASONS };
  }

  @Post()
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { targetUserId?: string; reason?: string; details?: string; gameId?: string }
  ) {
    return this.reportsService.submit(user.id, body);
  }

  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.myReports(user.id);
  }
}
