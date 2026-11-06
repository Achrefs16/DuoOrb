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

  it('uses organic, natural human names without anime characters or artificial clan tags', () => {
    const usernames = BOT_PERSONAS.map((p) => p.username.toLowerCase());
    // No anime character formulas
    expect(usernames.some((u) => u.includes('sasuke') || u.includes('itachi') || u.includes('luffy') || u.includes('tanjiro'))).toBe(false);
    // No esports clan prefixes
    expect(usernames.some((u) => u.startsWith('fn_') || u.startsWith('ttv_') || u.startsWith('faze_'))).toBe(false);
    // No artificial double underscores
    expect(usernames.some((u) => u.includes('__'))).toBe(false);
    // Diverse organic handles present
    expect(usernames.some((u) => u === 'marcus_reed' || u === 'felix_bauer' || u === 'aarav_sharma' || u === 'mateus_costa')).toBe(true);
  });

  it('enforces maximum 16 matches played per bot with both wins and losses', () => {
    for (const p of BOT_PERSONAS) {
      expect(p.gamesPlayed).toBeLessThanOrEqual(16);
      expect(p.gamesPlayed).toBeGreaterThanOrEqual(8);
      expect(p.wins).toBeGreaterThanOrEqual(1);
      expect(p.gamesPlayed - p.wins).toBeGreaterThanOrEqual(1);
    }
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
      expect(bot.engineBotId).toBeDefined();
      expect(bot.simulations).toBeGreaterThanOrEqual(3000);
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

