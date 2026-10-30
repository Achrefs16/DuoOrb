import { beforeEach, describe, expect, it } from 'vitest';
import { BOT_ROSTER, botById } from '@duoorb/game-core';
import {
  AD_UNLOCKABLE_BOT_IDS,
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

  it('partitions all 39 bots into 16 ad-unlockable and 23 premium-only bots', () => {
    expect(AD_UNLOCKABLE_BOT_IDS.size).toBe(16);
    expect(PREMIUM_ONLY_BOT_IDS.size).toBe(23);

    const total = AD_UNLOCKABLE_BOT_IDS.size + PREMIUM_ONLY_BOT_IDS.size;
    expect(total).toBe(39);
    expect(BOT_ROSTER.length).toBe(39);

    for (const bot of BOT_ROSTER) {
      const type = getBotAccessType(bot.id);
      expect(['ad_unlock', 'premium_only']).toContain(type);
    }
  });

  it('initially locks ALL 39 bots for free players (requires video or subscription)', () => {
    for (const bot of BOT_ROSTER) {
      expect(isBotLocked(bot, false)).toBe(true);
    }
    expect(anyBotLocked(BOT_ROSTER.map((b) => b.id), false)).toBe(true);
  });

  it('unlocks all 39 bots without restriction for premium subscribers', () => {
    for (const bot of BOT_ROSTER) {
      expect(isBotLocked(bot, true)).toBe(false);
    }
    expect(anyBotLocked(BOT_ROSTER.map((b) => b.id), true)).toBe(false);
  });

  it('permanently unlocks an ad-unlockable bot after watching 1 video', async () => {
    const martin = botById('martin');
    const bram = botById('bram');
    const achref = botById('achref');

    // All initially locked
    expect(isBotLocked(martin, false)).toBe(true);
    expect(isBotLocked(bram, false)).toBe(true);
    expect(isBotLocked(achref, false)).toBe(true);

    // Watch video for Martin
    await markBotPermanentlyUnlocked('martin');
    expect(isBotLocked(martin, false)).toBe(false);
    expect(isBotLocked(bram, false)).toBe(true);

    // Watch video for Grandmaster Achref
    await markBotPermanentlyUnlocked('achref');
    expect(isBotLocked(achref, false)).toBe(false);

    // Martin and Achref are both unlocked
    expect(anyBotLocked(['martin', 'achref'], false)).toBe(false);
    expect(anyBotLocked(['martin', 'bram'], false)).toBe(true);
  });

  it('keeps premium-only bots locked for free players (can only be unlocked via subscription)', () => {
    const clara = botById('clara');       // Beginner premium-only
    const fiona = botById('fiona');       // Intermediate premium-only
    const jin = botById('jin');           // Master premium-only
    const milo = botById('milo');         // Grandmaster premium-only

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
