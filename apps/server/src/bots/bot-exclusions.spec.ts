import { describe, expect, it, vi } from 'vitest';
import { RatingsService } from '../rating/ratings.service.js';
import { UsersService } from '../users/users.service.js';
import { BOT_ID_PREFIX } from './bot-ids.js';
import { GUEST_ID_PREFIX } from '../guest/guest.service.js';

describe('Bot Exclusions from Leaderboard and Search', () => {
  it('RatingsService.getLeaderboard excludes guests while keeping seeded global rankings', async () => {
    let capturedWhere: any = null;
    const mockPrisma: any = {
      isConnected: true,
      rating: {
        count: vi.fn().mockImplementation(({ where }) => {
          capturedWhere = where;
          return Promise.resolve(0);
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new RatingsService(mockPrisma);
    await service.getLeaderboard('UNIVERSAL', 10, 0);

    expect(capturedWhere).toBeDefined();
    expect(capturedWhere.gamesPlayed).toEqual({ gt: 0 });
    expect(capturedWhere.userId).toEqual({ not: { startsWith: GUEST_ID_PREFIX } });
  });

  it('RatingsService.getMyRank returns GUEST_EXCLUDED for bot user IDs', async () => {
    const mockPrisma: any = {
      isConnected: true,
    };
    const service = new RatingsService(mockPrisma);
    const result = await service.getMyRank(`${BOT_ID_PREFIX}us_001`);
    expect(result).toEqual({ ranked: false, reason: 'GUEST_EXCLUDED' });
  });

  it('UsersService.countOnlineUsers excludes bot accounts', async () => {
    let capturedWhere: any = null;
    const mockPrisma: any = {
      isConnected: true,
      profile: {
        count: vi.fn().mockImplementation(({ where }) => {
          capturedWhere = where;
          return Promise.resolve(42);
        }),
      },
    };

    const service = new UsersService(mockPrisma);
    const res = await service.countOnlineUsers();
    expect(res.count).toBeGreaterThanOrEqual(42 + 38);
    expect(capturedWhere.userId).toEqual({ not: { startsWith: BOT_ID_PREFIX } });
  });

  it('UsersService.searchUsers excludes bot accounts from query', async () => {
    let capturedWhere: any = null;
    const mockPrisma: any = {
      isConnected: true,
      profile: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          capturedWhere = where;
          return Promise.resolve([]);
        }),
      },
    };

    const service = new UsersService(mockPrisma);
    await service.searchUsers('Lukas', 'self_user_id');

    expect(capturedWhere.AND).toContainEqual({
      userId: { not: { startsWith: BOT_ID_PREFIX } },
    });
  });
});
