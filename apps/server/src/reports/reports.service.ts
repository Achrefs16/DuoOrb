import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

/**
 * UGC moderation queue (Play UGC policy).
 *
 * Reports are filed in-app (profile / history opponent / friend rows) and
 * reviewed out-of-band. Rate-limited per reporter (10/day) to prevent
 * report-spam as harassment. Reasons are a closed enum so the review queue
 * stays triageable.
 */
export const REPORT_REASONS = [
  'harassment',
  'hate',
  'sexual_content',
  'cheating',
  'spam',
  'impersonation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

const MAX_REPORTS_PER_DAY = 10;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    reporterId: string,
    body: { targetUserId?: string; reason?: string; details?: string; gameId?: string }
  ) {
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const details = typeof body?.details === 'string' ? body.details.slice(0, 500).trim() : '';
    const gameId = typeof body?.gameId === 'string' ? body.gameId.slice(0, 64).trim() : '';

    if (!targetUserId) throw new BadRequestException('Target user is required.');
    if (targetUserId === reporterId) throw new BadRequestException('Cannot report yourself.');
    if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
      throw new BadRequestException('Invalid report reason.');
    }
    if (!this.prisma.isConnected) throw new BadRequestException('Reporting is unavailable right now.');

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Reported user not found.');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.report.count({
      where: { reporterId, createdAt: { gt: since } },
    });
    if (recent >= MAX_REPORTS_PER_DAY) {
      throw new BadRequestException('Report limit reached. Try again tomorrow.');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetUserId,
        reason,
        details: details || null,
        gameId: gameId || null,
      },
    });
    return { submitted: true as const, id: report.id };
  }

  async myReports(reporterId: string) {
    if (!this.prisma.isConnected) return [];
    return this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
