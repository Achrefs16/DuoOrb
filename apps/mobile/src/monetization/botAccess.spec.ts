import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_ROSTER, botById } from '@duoorb/game-core';
import {
  AD_UNLOCKABLE_BOT_IDS,
  FREE_BOT_IDS,
  PREMIUM_ONLY_BOT_IDS,
  _resetAdUnlockedBotsForTests,
  anyBotLocked,
  getBotAccessType,
  isBotLocked,
  markBotPermanentlyUnlocked,
} from './botAccess';

describe('botAccess', () => {
  beforeEach(() => {
    _resetAdUnlockedBotsForTests();
  });

  it('partitions all 39 bots into 2 free, 14 ad-unlockable, and 23 premium-only bots', () => {
    expect(FREE_BOT_IDS.size).toBe(2);
    expect(AD_UNLOCKABLE_BOT_IDS.size).toBe(14);
    expect(PREMIUM_ONLY_BOT_IDS.size).toBe(23);

    const total =
      FREE_BOT_IDS.size + AD_UNLOCKABLE_BOT_IDS.size + PREMIUM_ONLY_BOT_IDS.size;
    expect(total).toBe(39);
    expect(BOT_ROSTER.length).toBe(39);

    for (const bot of BOT_ROSTER) {
      const type = getBotAccessType(bot.id);
      expect(['free', 'ad_unlock', 'premium_only']).toContain(type);
    }
  });

  it('keeps free starter bots (Martin & Bram) always unlocked with no ads or subscription needed', () => {
    const martin = botById('martin');
    const bram = botById('bram');

    // Both are 100% unlocked out of the box even for free users
    expect(isBotLocked(martin, false)).toBe(false);
    expect(isBotLocked(bram, false)).toBe(false);

    expect(getBotAccessType('martin')).toBe('free');
    expect(getBotAccessType('bram')).toBe('free');

    expect(anyBotLocked(['martin', 'bram'], false)).toBe(false);
  });

  it('initially locks all non-free bots for free players (requires video or subscription)', () => {
    for (const bot of BOT_ROSTER) {
      if (FREE_BOT_IDS.has(bot.id)) {
        expect(isBotLocked(bot, false)).toBe(false);
      } else {
        expect(isBotLocked(bot, false)).toBe(true);
      }
    }
    expect(anyBotLocked(BOT_ROSTER.map((b) => b.id), false)).toBe(true);
  });

  it('unlocks all 39 bots without restriction for premium subscribers', () => {
    for (const bot of BOT_ROSTER) {
      expect(isBotLocked(bot, true)).toBe(false);
    }
    expect(anyBotLocked(BOT_ROSTER.map((b) => b.id), true)).toBe(false);
  });

  it('unlocks beginner/intermediate ad-bots permanently and master/grandmaster bots for 7 days', async () => {
    const pip = botById('pip');
    const nelson = botById('nelson');
    const achref = botById('achref');

    // All initially locked
    expect(isBotLocked(pip, false)).toBe(true);
    expect(isBotLocked(nelson, false)).toBe(true);
    expect(isBotLocked(achref, false)).toBe(true);

    // Watch video for Pip (Beginner)
    await markBotPermanentlyUnlocked('pip');
    expect(isBotLocked(pip, false)).toBe(false);
    expect(isBotLocked(nelson, false)).toBe(true);

    // Watch video for Grandmaster Achref
    await markBotPermanentlyUnlocked('achref');
    expect(isBotLocked(achref, false)).toBe(false);

    // Pip and Achref are both unlocked initially
    expect(anyBotLocked(['pip', 'achref'], false)).toBe(false);
    expect(anyBotLocked(['pip', 'nelson'], false)).toBe(true);

    // Simulate 8 days later (> 7 days TTL)
    const eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(eightDaysLater);

    // Pip (Beginner) is still permanently unlocked
    expect(isBotLocked(pip, false)).toBe(false);
    // Grandmaster Achref has expired after 7 days
    expect(isBotLocked(achref, false)).toBe(true);

    dateSpy.mockRestore();
  });

  it('keeps premium-only bots locked for free players (can only be unlocked via subscription)', () => {
    const clara = botById('clara'); // Beginner premium-only
    const fiona = botById('fiona'); // Intermediate premium-only
    const jin = botById('jin'); // Master premium-only
    const milo = botById('milo'); // Grandmaster premium-only

    expect(isBotLocked(clara, false)).toBe(true);
    expect(isBotLocked(fiona, false)).toBe(true);
    expect(isBotLocked(jin, false)).toBe(true);
    expect(isBotLocked(milo, false)).toBe(true);

    // They unlock immediately for subscribers
    expect(isBotLocked(clara, true)).toBe(false);
    expect(isBotLocked(fiona, true)).toBe(false);
    expect(isBotLocked(jin, true)).toBe(false);
    expect(isBotLocked(milo, true)).toBe(false);
  });
});
