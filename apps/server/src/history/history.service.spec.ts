import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from './history.service.js';
import { BOT_ID_PREFIX } from '../bots/bot-ids.js';

describe('HistoryService', () => {
  it('caps bot history to 6 games max', async () => {
    let capturedTake = 0;
    const mockPrisma: any = {
      isConnected: true,
      gamePlayer: {
        findMany: vi.fn().mockImplementation(({ take }) => {
          capturedTake = take;
          return Promise.resolve([
            {
              isWinner: true,
              game: {
                id: 'bot_game_1',
                mode: '2p',
                status: 'COMPLETED',
                players: [],
                startedAt: new Date(),
                endedAt: new Date(),
              },
            },
          ]);
        }),
        count: vi.fn().mockResolvedValue(45), // 45 total games in DB
        groupBy: vi.fn().mockResolvedValue([
          { isWinner: true, _count: { isWinner: 30 } },
          { isWinner: false, _count: { isWinner: 15 } },
        ]),
      },
    };

    const service = new HistoryService(mockPrisma);
    const botUserId = `${BOT_ID_PREFIX}us_001`;
    const res = await service.getUserHistory(botUserId, 20, 0);

    // Bot query should cap take at 6
    expect(capturedTake).toBe(6);
    // Bot query should cap total at 6
    expect(res.total).toBe(6);
    expect(res.summary.total).toBe(6);
  });

  it('keeps normal pagination for human players', async () => {
    let capturedTake = 0;
    const mockPrisma: any = {
      isConnected: true,
      gamePlayer: {
        findMany: vi.fn().mockImplementation(({ take }) => {
          capturedTake = take;
          return Promise.resolve([]);
        }),
        count: vi.fn().mockResolvedValue(45),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new HistoryService(mockPrisma);
    const humanUserId = 'u_human_123';
    const res = await service.getUserHistory(humanUserId, 20, 0);

    expect(capturedTake).toBe(20);
    expect(res.total).toBe(45);
  });
});

