import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { GUEST_ID_PREFIX } from '../guest/guest.service.js';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ranked accounts only: guests play rated games and keep their rating
   * (see getMe), but never appear on the board. Guest rows are filtered
   * here, never deleted.
   */
  private rankedWhere() {
    return {
      gamesPlayed: { gt: 0 },
      userId: { not: { startsWith: GUEST_ID_PREFIX } },
    };
  }

  private toEntry(r: any, rank: number) {
    const winRate = r.gamesPlayed > 0 ? Number(((r.wins / r.gamesPlayed) * 100).toFixed(1)) : 0;
    // Badge-effective premium (P5.2): same no-write rule as public profiles —
    // report the effective value, let /me persist the flip.
    const premiumExpiresAt = r.user.profile?.premiumExpiresAt ?? null;
    return {
      rank,
      userId: r.userId,
      username: r.user.profile?.username ?? `player_${r.userId.slice(0, 6)}`,
      displayName: r.user.profile?.displayName ?? 'Player',
      avatarUrl: r.user.profile?.avatarUrl,
      isPremium:
        (r.user.profile?.isPremium ?? false) &&
        (!premiumExpiresAt || new Date(premiumExpiresAt).getTime() > Date.now()),
      rating: Math.round(r.rating),
      rd: Math.round(r.rd),
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      losses: r.losses,
      winRate,
    };
  }

  async getLeaderboard(_mode = 'UNIVERSAL', limit = 50, offset = 0) {
    if (!this.prisma.isConnected) return { entries: [], total: 0, limit, offset };
    const take = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 50);
    const skip = Math.max(parseInt(String(offset), 10) || 0, 0);
    const where = this.rankedWhere();

    const [total, ratings] = await Promise.all([
      this.prisma.rating.count({ where }),
      this.prisma.rating.findMany({
        where,
        // Stable pagination: rating, then activity, then id — tied rows can
        // never swap places between pages.
        orderBy: [{ rating: 'desc' }, { gamesPlayed: 'desc' }, { userId: 'asc' }],
        skip,
        take,
        include: {
          user: {
            include: { profile: true },
          },
        },
      }),
    ]);

    return {
      entries: ratings.map((r, idx) => this.toEntry(r, skip + idx + 1)),
      total,
      limit: take,
      offset: skip,
    };
  }

  /**
   * Where a linked account sits on the board. Guests are not ranked — they
   * get `{ ranked: false }` (never a 403) so the client shows the link card
   * instead of an error. Unplayed accounts get UNRANKED for the same reason.
   */
  async getMyRank(userId: string) {
    if (!this.prisma.isConnected) return { ranked: false as const, reason: 'UNRANKED' };
    if (userId.startsWith(GUEST_ID_PREFIX)) {
      return { ranked: false as const, reason: 'GUEST_EXCLUDED' };
    }
    const where = this.rankedWhere();
    const mine = await this.prisma.rating.findUnique({ where: { userId } });
    if (!mine || mine.gamesPlayed === 0) {
      return { ranked: false as const, reason: 'UNRANKED' };
    }

    // Position in the exact board order above: everyone strictly ahead, plus
    // tied rows the orderBy would place first (more games, then lower id).
    // Documented choice: rank mirrors the paged list row-for-row.
    const [ahead, tiedAhead] = await Promise.all([
      this.prisma.rating.count({ where: { ...where, rating: { gt: mine.rating } } }),
      this.prisma.rating.count({
        where: {
          ...where,
          rating: mine.rating,
          OR: [{ gamesPlayed: { gt: mine.gamesPlayed } }, { userId: { lt: mine.userId } }],
        },
      }),
    ]);
    const rank = ahead + tiedAhead + 1;

    // Window: 10 rows above me, then me, then the rest of the page.
    const windowOffset = Math.max(0, rank - 1 - 10);
    const window = await this.getLeaderboard('UNIVERSAL', 50, windowOffset);
    const total = window.total;
    return {
      ranked: true as const,
      rank,
      rating: Math.round(mine.rating),
      total,
      windowOffset,
      entries: window.entries,
    };
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
