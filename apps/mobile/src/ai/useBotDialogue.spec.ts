import { describe, expect, it } from 'vitest';
import { BOT_ROSTER, botById, createInitialState } from '@duoorb/game-core';

describe('Bot Personas & Dialogue System', () => {
  it('every bot personality in BOT_ROSTER has all dialogue events populated', () => {
    for (const bot of BOT_ROSTER) {
      expect(bot.dialogue.greetings.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.playerBlock.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.botTrap.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.closeRace.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.botLead.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.playerLead.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.win.length).toBeGreaterThanOrEqual(2);
      expect(bot.dialogue.lose.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every bot has a distinct persona with quote, bio, and avatar key', () => {
    for (const bot of BOT_ROSTER) {
      expect(bot.quote.trim().length).toBeGreaterThan(5);
      expect(bot.bio.trim().length).toBeGreaterThan(10);
      expect(bot.avatarKey.trim().length).toBeGreaterThan(1);
      expect(['beginner', 'intermediate', 'master']).toContain(bot.tier);
    }
  });

  it('resolves bot by id cleanly', () => {
    const martin = botById('martin');
    expect(martin).not.toBeNull();
    expect(martin?.name).toBe('Martin');
    expect(martin?.tier).toBe('beginner');
    expect(martin?.elo).toBe(800);

    // Alias test
    const pipAlias = botById('pip');
    expect(pipAlias?.name).toBe('Martin');

    const viktor = botById('viktor');
    expect(viktor).not.toBeNull();
    expect(viktor?.name).toBe('Viktor');
    expect(viktor?.tier).toBe('master');
    expect(viktor?.elo).toBe(2100);
  });
});
