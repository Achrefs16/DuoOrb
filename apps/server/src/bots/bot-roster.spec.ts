import { describe, expect, it, vi } from 'vitest';
import { BOT_PERSONAS, personaById, BOT_MIN_RATING, BOT_MAX_RATING } from './bot-roster.js';
import { BOT_ID_PREFIX } from './bot-ids.js';
import { restoreBotRatingBand } from './bot-seeder.js';

describe('Bot Roster & Diverse 20-Pattern Naming', () => {
  it('contains exactly 120 personas', () => {
    expect(BOT_PERSONAS.length).toBe(120);
  });

  it('distributes 30 personas evenly across all 4 regions', () => {
    const regionCounts = { de: 0, us: 0, in: 0, br: 0 };
    for (const p of BOT_PERSONAS) {
      regionCounts[p.region]++;
    }
    expect(regionCounts).toEqual({
      de: 30,
      us: 30,
      in: 30,
      br: 30,
    });
  });

  it('has 120 unique usernames and display names', () => {
    const usernames = new Set(BOT_PERSONAS.map((p) => p.username.toLowerCase()));
    expect(usernames.size).toBe(120);
  });

  it('avoids repetitive single-letter naming formulas', () => {
    // None should end with repetitive pattern like '_a', '_b', '_f' etc.
    const repetitiveSuffixCount = BOT_PERSONAS.filter((p) => /_[a-z]$/i.test(p.username)).length;
    expect(repetitiveSuffixCount).toBe(0);
  });

  it('includes diverse identity types: all-caps, anime, tech, formal, esports, numbers', () => {
    const usernames = BOT_PERSONAS.map((p) => p.username);
    // All caps
    expect(usernames.some((u) => u === 'NOVA' || u === 'APEX')).toBe(true);
    // Anime
    expect(usernames.some((u) => u === 'sasuke99' || u === 'itachi_7')).toBe(true);
    // Esports/prefix
    expect(usernames.some((u) => u.startsWith('fn_') || u.startsWith('ttv_'))).toBe(true);
    // Dot tech
    expect(usernames.some((u) => u.includes('.') && !u.includes('@'))).toBe(true);
    // Double underscore
    expect(usernames.some((u) => u.includes('__'))).toBe(true);
  });

  it('spans rating tiers from 900 to 2100 with ONNX enabled on high tiers', () => {
    const minRating = Math.min(...BOT_PERSONAS.map((p) => p.targetRating));
    const maxRating = Math.max(...BOT_PERSONAS.map((p) => p.targetRating));

    expect(minRating).toBeGreaterThanOrEqual(BOT_MIN_RATING);
    expect(maxRating).toBeLessThanOrEqual(BOT_MAX_RATING);
    expect(maxRating).toBeGreaterThanOrEqual(2000);

    const onnxBots = BOT_PERSONAS.filter((p) => p.useOnnx);
    expect(onnxBots.length).toBeGreaterThan(30);
    for (const bot of onnxBots) {
      expect(bot.engineBotId).toBe('milo');
    }
  });

  it('resolves personas by userId accurately', () => {
    const firstBot = BOT_PERSONAS[0];
    const retrieved = personaById(firstBot.userId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.username).toBe(firstBot.username);
    expect(retrieved?.userId.startsWith(BOT_ID_PREFIX)).toBe(true);
  });

  it('assigns diverse playstyles, authentic bios, and equipped badges', () => {
    const playstyles = new Set(BOT_PERSONAS.map((p) => p.playstyle));
    expect(playstyles.has('rush')).toBe(true);
    expect(playstyles.has('shiller')).toBe(true);
    expect(playstyles.has('split')).toBe(true);
    expect(playstyles.has('flank')).toBe(true);
    expect(playstyles.has('evasive')).toBe(true);
    expect(playstyles.has('counter')).toBe(true);

    for (const p of BOT_PERSONAS) {
      expect(p.bio.length).toBeGreaterThan(5);
      expect(p.equippedBadges.length).toBeGreaterThan(0);
      expect(p.createdAtDaysAgo).toBeGreaterThan(30);
    }
  });

  it('restoreBotRatingBand smoothly rubber-bands drifting bot ratings and clamps within ±120', async () => {
    const testBot = BOT_PERSONAS[0];
    let updatedData: any = null;
    const mockPrisma: any = {
      isConnected: true,
      rating: {
        findUnique: vi.fn().mockResolvedValue({
          userId: testBot.userId,
          rating: testBot.targetRating + 90, // drifted +90
          rd: 70,
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          updatedData = data;
          return Promise.resolve();
        }),
      },
    };

    await restoreBotRatingBand(mockPrisma, testBot.userId);
    expect(mockPrisma.rating.update).toHaveBeenCalled();
    // 90 * 0.65 = 58.5 -> targetRating + 59
    expect(updatedData.rating).toBeLessThan(testBot.targetRating + 90);
    expect(updatedData.rating).toBeGreaterThan(testBot.targetRating);
  });
});

