import { describe, expect, it } from 'vitest';
import { computeBotStars } from './botStars';
import { mergeBotStarsMaps, type BotStarMap } from '../storage/gameStorage';

describe('bot mastery stars', () => {
  it('awards 3 stars for a clean win', () => {
    expect(computeBotStars(0)).toBe(3);
  });

  it('awards 2 stars for one assist', () => {
    expect(computeBotStars(1)).toBe(2);
  });

  it('caps a win at 1 star for two or more assists', () => {
    expect(computeBotStars(2)).toBe(1);
    expect(computeBotStars(3)).toBe(1);
    expect(computeBotStars(99)).toBe(1);
  });

  it('treats invalid counts as a clean win', () => {
    expect(computeBotStars(-1)).toBe(3);
    expect(computeBotStars(Number.NaN)).toBe(3);
    expect(computeBotStars(Number.POSITIVE_INFINITY)).toBe(3);
  });

  it('handles floating point assist numbers gracefully', () => {
    expect(computeBotStars(0.5)).toBe(3);
    expect(computeBotStars(1.2)).toBe(2);
    expect(computeBotStars(2.8)).toBe(1);
  });

  it('merges local and remote bot stars without regressing progress', () => {
    const local: BotStarMap = {
      bot1: { botKey: 'bot1', stars: 2, wins: 3, bestMarginSteps: 4, updatedAt: '2026-10-01T00:00:00Z' },
      bot2: { botKey: 'bot2', stars: 3, wins: 1, bestMarginSteps: 6, updatedAt: '2026-10-01T00:00:00Z' },
    };
    const remote: BotStarMap = {
      // Remote has 3 stars for bot1 (should upgrade)
      bot1: { botKey: 'bot1', stars: 3, wins: 4, bestMarginSteps: 8, updatedAt: '2026-10-02T00:00:00Z' },
      // Remote has 1 star for bot2 (should keep local 3 stars)
      bot2: { botKey: 'bot2', stars: 1, wins: 0, bestMarginSteps: 0, updatedAt: '2026-10-02T00:00:00Z' },
      // New bot3 on remote
      bot3: { botKey: 'bot3', stars: 1, wins: 1, bestMarginSteps: 2, updatedAt: '2026-10-02T00:00:00Z' },
    };

    const merged = mergeBotStarsMaps(local, remote);
    expect(merged.bot1.stars).toBe(3);
    expect(merged.bot1.wins).toBe(4);
    expect(merged.bot1.bestMarginSteps).toBe(8);

    expect(merged.bot2.stars).toBe(3);
    expect(merged.bot2.wins).toBe(1);
    expect(merged.bot2.bestMarginSteps).toBe(6);

    expect(merged.bot3.stars).toBe(1);
  });
});
