import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserHistory(userId: string, limit = 20, offset = 0) {
    if (!this.prisma.isConnected) return { games: [], total: 0 };

    const [players, total, groups] = await Promise.all([
      this.prisma.gamePlayer.findMany({
        where: { userId, game: { status: 'COMPLETED' } },
        include: {
          game: {
            include: {
              players: {
                include: {
                  user: {
                    include: {
                      profile: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { game: { endedAt: 'desc' } },
        take: limit,
        skip: offset,
      }),
      this.prisma.gamePlayer.count({ where: { userId, game: { status: 'COMPLETED' } } }),
      // One cheap aggregation for lifetime totals — no per-row math,
      // no denormalized counters to drift.
      this.prisma.gamePlayer.groupBy({
        by: ['isWinner'],
        where: { userId, game: { status: 'COMPLETED' } },
        _count: { isWinner: true },
      }),
    ]);

    const games = players.map((gp) => {
      const game = gp.game;
      const opponentPlayer = game.players.find((p) => p.userId !== userId);
      const isWinner = gp.isWinner;
      const isDraw = !game.winnerId && game.status === 'COMPLETED';

      const durationMs =
        game.startedAt && game.endedAt
          ? game.endedAt.getTime() - game.startedAt.getTime()
          : 0;

      return {
        gameId: game.id,
        mode: game.mode,
        status: game.status,
        isRanked: game.isRanked,
        timeControlMinutes: game.timeControlMinutes,
        incrementSeconds: game.incrementSeconds,
        rulesetVersion: game.rulesetVersion,
        outcome: isWinner ? 'WIN' : isDraw ? 'DRAW' : 'LOSS',
        placement: gp.placement,
        endedReason: game.endedReason,
        endedAt: game.endedAt,
        durationMs,
        myRating: {
          before: gp.ratingBefore,
          after: gp.ratingAfter,
          delta: gp.ratingBefore && gp.ratingAfter ? gp.ratingAfter - gp.ratingBefore : 0,
        },
        opponent: opponentPlayer
          ? {
              userId: opponentPlayer.userId,
              // `username` is the canonical display name everywhere (see
              // handleConnection in the gateway). Exposing it in BOTH fields
              // means a client can read either one and get the same answer —
              // previously `displayName` returned the auto-generated guest
              // handle here while the match showed the chosen username, so the
              // same opponent appeared under two names.
              username: opponentPlayer.user.profile?.username ?? 'opponent',
              displayName:
                opponentPlayer.user.profile?.username ??
                opponentPlayer.user.profile?.displayName ??
                'Opponent',
              avatarUrl: opponentPlayer.user.profile?.avatarUrl,
              ratingBefore: opponentPlayer.ratingBefore,
              ratingAfter: opponentPlayer.ratingAfter,
            }
          : null,
      };
    });

    return {
      games,
      total,
      summary: {
        total,
        wins: groups.find((g) => g.isWinner)?._count.isWinner ?? 0,
        losses: groups.find((g) => !g.isWinner)?._count.isWinner ?? 0,
      },
    };
  }

  async getGameReplay(gameId: string) {
    if (!this.prisma.isConnected) {
      throw new NotFoundException('Game not found.');
    }

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        moves: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found.');
    }

    return {
      gameId: game.id,
      mode: game.mode,
      status: game.status,
      isRanked: game.isRanked,
      timeControlMinutes: game.timeControlMinutes,
      incrementSeconds: game.incrementSeconds,
      rulesetVersion: game.rulesetVersion,
      winnerId: game.winnerId,
      winnerUserId: game.winnerUserId,
      endedReason: game.endedReason,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      players: game.players.map((p) => ({
        userId: p.userId,
        playerIndex: p.playerIndex,
        // username is the canonical display name (see handleConnection in the
        // gateway). This is the second of two name-resolution sites in this
        // file — the other is the `opponent` block in getUserHistory — and it
        // was missed the first time, so a match's player list and its summary
        // could disagree.
        username: p.user.profile?.username ?? `player_${p.userId.slice(0, 6)}`,
        displayName:
          p.user.profile?.username ??
          p.user.profile?.displayName ??
          `player_${p.userId.slice(0, 6)}`,
        ratingBefore: p.ratingBefore,
        ratingAfter: p.ratingAfter,
        isWinner: p.isWinner,
        placement: p.placement,
      })),
      moves: game.moves.map((m) => ({
        sequence: m.sequence,
        playerIndex: m.playerIndex,
        actionType: m.actionType,
        payload: m.payload,
        clockRemainingMs: m.clockRemainingMs,
        serverTimestamp: Number(m.serverTimestamp),
      })),
    };
  }
}
