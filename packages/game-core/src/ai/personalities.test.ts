import { describe, expect, it } from 'vitest';
import { createInitialState } from '../index.js';
import { getBestAction } from './engine.js';
import { BOT_ROSTER, botById, botLadder, botsByTier } from './personalities.js';

/**
 * Premium bot roster (MONETIZATION.md P4.1): valid data AND playable engines.
 * Every personality must plug into getBestAction and return a legal move on a
 * fresh board — a mistyped weight or depth must fail here, not mid-match.
 */
describe('bot roster data', () => {
  it('has unique ids and names', () => {
    const ids = BOT_ROSTER.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = BOT_ROSTER.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('ladders weakest-first with ascending ELO', () => {
    const ladder = botLadder();
    expect(ladder).toHaveLength(BOT_ROSTER.length);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i].elo).toBeGreaterThan(ladder[i - 1].elo);
    }
  });

  it('marks every roster entry premium with full presentation, bio, quote, dialogue + banter', () => {
    for (const b of BOT_ROSTER) {
      expect(b.premium).toBe(true);
      expect(b.name.trim().length).toBeGreaterThan(0);
      expect(b.title.trim().length).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'master']).toContain(b.tier);
      expect(b.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(b.avatarKey.trim().length).toBeGreaterThan(0);
      expect(b.avatarGlyph.trim().length).toBeGreaterThan(0);
      expect(b.style.trim().length).toBeGreaterThan(0);
      expect(b.bio.trim().length).toBeGreaterThan(0);
      expect(b.quote.trim().length).toBeGreaterThan(0);
      expect(b.banter.taunt.length).toBeGreaterThan(0);
      expect(b.banter.praise.length).toBeGreaterThan(0);
      expect(b.dialogue.greetings.length).toBeGreaterThan(0);
      expect(b.dialogue.playerBlock.length).toBeGreaterThan(0);
      expect(b.dialogue.botTrap.length).toBeGreaterThan(0);
      expect(b.dialogue.closeRace.length).toBeGreaterThan(0);
      expect(b.dialogue.botLead.length).toBeGreaterThan(0);
      expect(b.dialogue.playerLead.length).toBeGreaterThan(0);
      expect(b.dialogue.win.length).toBeGreaterThan(0);
      expect(b.dialogue.lose.length).toBeGreaterThan(0);
    }
  });

  it('groups bots by tier correctly', () => {
    const tiers = botsByTier();
    expect(tiers.beginner.length).toBeGreaterThan(0);
    expect(tiers.intermediate.length).toBeGreaterThan(0);
    expect(tiers.master.length).toBeGreaterThan(0);
    const total = tiers.beginner.length + tiers.intermediate.length + tiers.master.length;
    expect(total).toBe(BOT_ROSTER.length);
  });

  it('keeps engine parameters in sane ranges', () => {
    for (const b of BOT_ROSTER) {
      const p = b.profile;
      expect(['easy', 'normal', 'hard']).toContain(p.difficulty);
      expect(p.engine).toBe('mcts');
      expect(p.simulations).toBeGreaterThan(0);
      expect(p.uctConst).toBeGreaterThan(0);
      expect(p.wallMoveProb).toBeGreaterThan(0);
      expect(p.blockMoveProb).toBeGreaterThan(0);
      expect(p.depth).toBeGreaterThanOrEqual(1);
      expect(p.depth).toBeLessThanOrEqual(4);
      expect(p.randomness).toBeGreaterThanOrEqual(0);
      expect(p.randomness).toBeLessThanOrEqual(0.5);
      expect(p.maxCandidateWalls).toBeGreaterThan(0);
      expect(p.timeBudgetMs).toBeGreaterThan(0);
      for (const w of Object.values(p.weights)) {
        expect(Number.isFinite(w)).toBe(true);
      }
    }
  });

  it('resolves by id and misses cleanly', () => {
    expect(botById('nelson')?.name).toBe('Nelson');
    expect(botById('vex')?.name).toBe('Nelson');
    expect(botById('achref')?.name).toBe('Achref');
    expect(botById('architect')?.name).toBe('Achref');
    expect(botById('nope')).toBeNull();
    expect(botById(null)).toBeNull();
  });
});

describe('bot roster engines', () => {
  it('every personality returns a legal opening move', () => {
    const state = createInitialState({
      mode: '2p',
      playerNames: ['You', 'Bot'],
    });
    for (const b of BOT_ROSTER) {
      const action = getBestAction(state, b.profile, 42);
      expect(action, `${b.id} returned no move`).not.toBeNull();
    }
  }, 15_000);
});
