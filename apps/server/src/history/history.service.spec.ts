import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from './history.service.js';
import { BOT_ID_PREFIX } from '../bots/bot-ids.js';

describe('HistoryService', () => {
  it('returns full, uncapped match history and accurate career totals for bot players', async () => {
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
                id: 'bot_match_0001',
                mode: '2p',
                status: 'COMPLETED',
                players: [],
                startedAt: new Date(),
                endedAt: new Date(),
              },
            },
          ]);
        }),
        count: vi.fn().mockResolvedValue(12),
        groupBy: vi.fn().mockResolvedValue([
          { isWinner: true, _count: { isWinner: 8 } },
          { isWinner: false, _count: { isWinner: 4 } },
        ]),
      },
    };

    const service = new HistoryService(mockPrisma);
    const botUserId = `${BOT_ID_PREFIX}us_001`;
    const res = await service.getUserHistory(botUserId, 20, 0);

    expect(capturedTake).toBe(20);
    expect(res.total).toBe(12);
    expect(res.summary.total).toBe(12);
    expect(res.summary.wins).toBe(8);
    expect(res.summary.losses).toBe(4);
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

