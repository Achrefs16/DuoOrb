import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(_mode = 'UNIVERSAL', limit = 50) {
    if (!this.prisma.isConnected) return [];

    const ratings = await this.prisma.rating.findMany({
      where: {
        gamesPlayed: { gt: 0 },
      },
      orderBy: { rating: 'desc' },
      take: limit,
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    return ratings.map((r, rank) => {
      const winRate = r.gamesPlayed > 0 ? Number(((r.wins / r.gamesPlayed) * 100).toFixed(1)) : 0;
      return {
        rank: rank + 1,
        userId: r.userId,
        username: r.user.profile?.username ?? `player_${r.userId.slice(0, 6)}`,
        displayName: r.user.profile?.displayName ?? 'Player',
        avatarUrl: r.user.profile?.avatarUrl,
        rating: Math.round(r.rating),
        rd: Math.round(r.rd),
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
        losses: r.losses,
        winRate,
      };
    });
  }

  async getRatingHistory(userId: string, _mode = 'UNIVERSAL', limit = 30) {
    if (!this.prisma.isConnected) return [];

    const history = await this.prisma.ratingHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return history.reverse().map((h) => ({
      gameId: h.gameId,
      mode: h.mode,
      ratingBefore: Math.round(h.ratingBefore),
      ratingAfter: Math.round(h.ratingAfter),
      delta: Math.round(h.delta),
      algorithmVersion: h.algorithmVersion,
      timestamp: h.createdAt,
    }));
  }

  /**
   * Basic anti-farming observability over the append-only history.
   * Flags (never auto-punishes): the same opponent faced N+ times in the
   * window with a lopsided transfer, or a fresh account swinging hundreds
   * of points in a few games. Returns human-readable reasons.
   */
  flagSuspiciousTransfers(
    entries: { gameId: string; opponentUserId?: string; delta: number; gamesPlayedBefore?: number }[],
    opts: { sameOpponentThreshold?: number; freshAccountSwing?: number } = {}
  ): string[] {
    const sameOpponentThreshold = opts.sameOpponentThreshold ?? 8;
    const freshAccountSwing = opts.freshAccountSwing ?? 300;
    const flags: string[] = [];
    const byOpponent = new Map<string, { games: number; net: number }>();
    for (const e of entries) {
      if (!e.opponentUserId) continue;
      const agg = byOpponent.get(e.opponentUserId) ?? { games: 0, net: 0 };
      agg.games += 1;
      agg.net += e.delta;
      byOpponent.set(e.opponentUserId, agg);
    }
    for (const [opp, agg] of byOpponent) {
      if (agg.games >= sameOpponentThreshold && Math.abs(agg.net) >= freshAccountSwing) {
        flags.push(`repeated opponent ${opp.slice(0, 6)}: ${agg.games} games, net ${Math.round(agg.net)}`);
      }
    }
    const fresh = entries.filter((e) => (e.gamesPlayedBefore ?? 99) < 5);
    const freshNet = fresh.reduce((s, e) => s + e.delta, 0);
    if (fresh.length >= 3 && Math.abs(freshNet) >= freshAccountSwing) {
      flags.push(`fresh account swing: ${Math.round(freshNet)} over ${fresh.length} games`);
    }
    return flags;
  }
}
