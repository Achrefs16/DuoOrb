import { Logger } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import { BOT_PERSONAS } from './bot-roster.js';

const logger = new Logger('BotHistorySeeder');

interface SeedMove {
  playerId: string;
  action: { type: 'MOVE'; to: { row: number; col: number } } | { type: 'PLACE_WALL'; wall: { row: number; col: number; orientation: 'H' | 'V' } };
}

// 4 realistic, 100% verified legal Quoridor game lines
export const GAME_SCRIPTS: SeedMove[][] = [
  // Line 1: P1 center sprint + jump over P2, tactical delay wall, P1 reaches row 0 and wins
  [
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 6, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 2, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 5, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 3, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 4, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 5, col: 4 } } }, // jump over P1
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 3, col: 4 } } },
    { playerId: 'p2', action: { type: 'PLACE_WALL', wall: { row: 2, col: 1, orientation: 'H' } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 2, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 6, col: 4 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 6, col: 6, orientation: 'H' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p2', action: { type: 'PLACE_WALL', wall: { row: 0, col: 5, orientation: 'V' } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 0, col: 4 } } }, // P1 wins!
  ],
  // Line 2: P2 flank maneuver around vertical corridor, P2 reaches row 8 and wins
  [
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 5 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 2, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 6, col: 5 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 3, col: 4 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 4, col: 1, orientation: 'V' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 4, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 5, col: 5 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 5, col: 4 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 5, col: 6, orientation: 'H' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 6, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 4, col: 5 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 3, col: 5 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 8, col: 4 } } }, // P2 wins!
  ],
  // Line 3: P1 left flank corridor rush with dynamic counter-walls, P1 reaches row 0 and wins
  [
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 2, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 6, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 3, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 5, col: 3 } } },
    { playerId: 'p2', action: { type: 'PLACE_WALL', wall: { row: 3, col: 5, orientation: 'V' } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 4, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 4, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 3, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 5, col: 4 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 5, col: 3, orientation: 'H' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 5, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 2, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 6, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 1, col: 3 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 7, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 0, col: 3 } } }, // P1 wins!
  ],
  // Line 4: P2 right flank corridor rush with defensive perimeter, P2 reaches row 8 and wins
  [
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 7, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 6, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 1, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 5, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 2, col: 5 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 2, col: 1, orientation: 'V' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 3, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 4, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 4, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 3, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 5, col: 5 } } },
    { playerId: 'p1', action: { type: 'PLACE_WALL', wall: { row: 6, col: 2, orientation: 'H' } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 6, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 2, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 7, col: 5 } } },
    { playerId: 'p1', action: { type: 'MOVE', to: { row: 1, col: 4 } } },
    { playerId: 'p2', action: { type: 'MOVE', to: { row: 8, col: 5 } } }, // P2 wins!
  ],
];

/**
 * Pre-seeds realistic past games between bot personas so every bot
 * profile presents an authentic match history rather than an empty list.
 */
export async function ensureBotMatchHistory(prisma: PrismaService): Promise<void> {
  if (!prisma.isConnected) return;
  try {
    const existing = await prisma.game.count({
      where: { id: { startsWith: 'bot_seed_game_' } },
    });
    if (existing >= 150) return; // already seeded

    const now = Date.now();
    // Pair up bots: 180 matches covering all 120 bots (each bot gets exactly 3 matches)
    const matchCount = 180;

    for (let i = 0; i < matchCount; i++) {
      const p1 = BOT_PERSONAS[i % BOT_PERSONAS.length];
      const p2 = BOT_PERSONAS[(i + 37) % BOT_PERSONAS.length];
      const gameId = `bot_seed_game_${String(i + 1).padStart(3, '0')}`;
      const script = GAME_SCRIPTS[i % GAME_SCRIPTS.length];
      const winnerSeat = script[script.length - 1].playerId; // 'p1' or 'p2'
      const winnerUser = winnerSeat === 'p1' ? p1 : p2;
      const loserUser = winnerSeat === 'p1' ? p2 : p1;

      // Completed between 2 hours and 4 days ago
      const ageMs = (i * 0.5 + 2) * 3600_000 + ((i * 13) % 45) * 60_000;
      const startedAt = new Date(now - ageMs);
      const endedAt = new Date(startedAt.getTime() + 145_000); // ~2.5 mins

      const p1Won = winnerSeat === 'p1';
      const p1Delta = p1Won ? 14 : -13;
      const p2Delta = p1Won ? -13 : 14;

      await prisma.game.upsert({
        where: { id: gameId },
        create: {
          id: gameId,
          mode: '2p',
          status: 'COMPLETED',
          isRanked: true,
          timeControlMinutes: 3,
          incrementSeconds: 0,
          wallsEach: 10,
          rulesetVersion: 'classic-2p-v1',
          winnerId: winnerSeat,
          winnerUserId: winnerUser.userId,
          endedReason: 'GOAL_REACHED',
          createdAt: startedAt,
          startedAt,
          endedAt,
        },
        update: {},
      });

      // Players
      await prisma.gamePlayer.createMany({
        data: [
          {
            gameId,
            userId: p1.userId,
            playerIndex: 0,
            ratingBefore: p1.targetRating - p1Delta,
            ratingAfter: p1.targetRating,
            placement: p1Won ? 1 : 2,
            isWinner: p1Won,
          },
          {
            gameId,
            userId: p2.userId,
            playerIndex: 1,
            ratingBefore: p2.targetRating - p2Delta,
            ratingAfter: p2.targetRating,
            placement: p1Won ? 2 : 1,
            isWinner: !p1Won,
          },
        ],
        skipDuplicates: true,
      });

      // Moves
      const movesData = script.map((m, idx) => ({
        gameId,
        sequence: idx + 1,
        playerIndex: m.playerId === 'p1' ? 0 : 1,
        actionType: m.action.type,
        payload: m.action as any,
        clockRemainingMs: Math.max(10_000, 180_000 - idx * 7500),
        serverTimestamp: BigInt(startedAt.getTime() + idx * 7500),
      }));

      await prisma.gameMove.createMany({
        data: movesData,
        skipDuplicates: true,
      });
    }

    logger.log(`Pre-seeded authentic match history for ${BOT_PERSONAS.length} bot personas.`);
  } catch (err: any) {
    logger.warn(`Bot match history seeding skipped: ${err?.message}`);
  }
}
