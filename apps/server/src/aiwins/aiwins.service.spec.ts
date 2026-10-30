import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiwinsService } from './aiwins.service.js';
import { achievementByCode, ACHIEVEMENTS } from './achievements.catalog.js';

describe('AiwinsService - Modern Achievements', () => {
  let service: AiwinsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      achievement: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'ach-1' }),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      profile: {
        findUnique: vi.fn().mockResolvedValue({ botStars: {} }),
      },
      rating: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      friendship: {
        count: vi.fn().mockResolvedValue(0),
      },
      aiWin: {
        count: vi.fn().mockResolvedValue(0),
      },
      gamePlayer: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    service = new AiwinsService(mockPrisma as any);
  });

  it('evaluates bot stars and grants bot-first-win and star milestone badges', async () => {
    const botStars = {
      martin: { botKey: 'martin', stars: 3, wins: 1, bestMarginSteps: 0, updatedAt: '' },
      pip: { botKey: 'pip', stars: 3, wins: 1, bestMarginSteps: 0, updatedAt: '' },
      elias: { botKey: 'elias', stars: 3, wins: 1, bestMarginSteps: 0, updatedAt: '' },
      barnaby: { botKey: 'barnaby', stars: 2, wins: 1, bestMarginSteps: 0, updatedAt: '' },
    }; // Total stars = 11

    const earned = await service.evaluateBotStars('u1', botStars);
    expect(earned).toContain('bot-first-win');
    expect(earned).toContain('bot-stars-10');
    expect(earned).not.toContain('bot-stars-30');
  });

  it('evaluates flawless Achref and Milo badges when 3 stars are achieved', async () => {
    const botStars = {
      achref: { botKey: 'achref', stars: 3, wins: 1, bestMarginSteps: 0, updatedAt: '' },
      milo: { botKey: 'milo', stars: 3, wins: 1, bestMarginSteps: 0, updatedAt: '' },
    };

    const earned = await service.evaluateBotStars('u1', botStars);
    expect(earned).toContain('bot-flawless-achref');
    expect(earned).toContain('bot-flawless-milo');
  });

  it('allows claiming valid client achievements idempotently', async () => {
    const res = await service.claimAchievement('u1', 'analysis-brilliant');
    expect(res.success).toBe(true);
    expect(res.newlyEarned?.code).toBe('analysis-brilliant');
    expect(mockPrisma.achievement.create).toHaveBeenCalledWith({
      data: { userId: 'u1', code: 'analysis-brilliant' },
    });

    // If already owned, returns null without re-creating
    mockPrisma.achievement.findUnique.mockResolvedValueOnce({ id: 'existing' });
    const res2 = await service.claimAchievement('u1', 'analysis-brilliant');
    expect(res2.success).toBe(true);
    expect(res2.newlyEarned).toBeNull();
  });

  it('catalog contains new categories: bot, battle, tactics, social', () => {
    const categories = new Set(ACHIEVEMENTS.map((a) => a.category));
    expect(categories.has('bot')).toBe(true);
    expect(categories.has('battle')).toBe(true);
    expect(categories.has('tactics')).toBe(true);
    expect(categories.has('social')).toBe(true);
  });
});

