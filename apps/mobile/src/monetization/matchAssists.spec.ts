import { describe, expect, it } from 'vitest';
import {
  createMatchAssists,
  canUseAssist,
  consumeAssist,
  canRefillAssists,
  refillAssists,
  willForfeitThreeStars,
  FREE_STARTING_HINTS,
  FREE_STARTING_UNDOS,
  PREMIUM_STARTING_HINTS,
  PREMIUM_STARTING_UNDOS,
} from './matchAssists';

describe('matchAssists economy (divided hints & undos)', () => {
  it('initializes free tier with 2 hints and 1 undo separately', () => {
    const s = createMatchAssists(false);
    expect(s.hintsRemaining).toBe(FREE_STARTING_HINTS);
    expect(s.undosRemaining).toBe(FREE_STARTING_UNDOS);
    expect(s.hintsRemaining).toBe(2);
    expect(s.undosRemaining).toBe(1);
    expect(s.used).toBe(0);
    expect(s.hintRefillsUsed).toBe(0);
    expect(s.undoRefillsUsed).toBe(0);
    expect(s.isPremium).toBe(false);
    expect(canUseAssist(s, 'hint')).toBe(true);
    expect(canUseAssist(s, 'undo')).toBe(true);
    expect(willForfeitThreeStars(s)).toBe(true);
  });

  it('initializes premium tier with 6 hints and 4 undos (zero ads, firm match cap)', () => {
    const s = createMatchAssists(true);
    expect(s.hintsRemaining).toBe(PREMIUM_STARTING_HINTS);
    expect(s.undosRemaining).toBe(PREMIUM_STARTING_UNDOS);
    expect(s.hintsRemaining).toBe(6);
    expect(s.undosRemaining).toBe(4);
    expect(s.used).toBe(0);
    expect(s.isPremium).toBe(true);
    expect(canUseAssist(s, 'hint')).toBe(true);
    expect(canUseAssist(s, 'undo')).toBe(true);
    expect(canRefillAssists(s, 'hint')).toBe(false);
    expect(canRefillAssists(s, 'undo')).toBe(false);
  });

  it('consumes hints and undos independently while tracking total used for stars', () => {
    let s = createMatchAssists(false);

    // Spend first hint -> hintsRemaining becomes 1, undosRemaining stays 1
    const stepHint1 = consumeAssist(s, 'hint');
    expect(stepHint1.ok).toBe(true);
    s = stepHint1.next;
    expect(s.hintsRemaining).toBe(1);
    expect(s.undosRemaining).toBe(1);
    expect(s.used).toBe(1);
    expect(willForfeitThreeStars(s)).toBe(false);

    // Spend second hint -> hintsRemaining becomes 0, undosRemaining stays 1
    const stepHint2 = consumeAssist(s, 'hint');
    expect(stepHint2.ok).toBe(true);
    s = stepHint2.next;
    expect(s.hintsRemaining).toBe(0);
    expect(s.undosRemaining).toBe(1);
    expect(s.used).toBe(2);

    // Cannot consume another hint without refilling
    expect(consumeAssist(s, 'hint').ok).toBe(false);
    // But CAN still consume the 1 free undo!
    const stepUndo = consumeAssist(s, 'undo');
    expect(stepUndo.ok).toBe(true);
    s = stepUndo.next;
    expect(s.undosRemaining).toBe(0);
    expect(s.used).toBe(3);
  });

  it('handles rewarded ad refills independently for hints (+3) and undos (+3) up to 1 refill per match', () => {
    let s = createMatchAssists(false);
    s = consumeAssist(s, 'hint').next;
    s = consumeAssist(s, 'hint').next;
    expect(s.hintsRemaining).toBe(0);
    expect(canRefillAssists(s, 'hint')).toBe(true);

    // Watch ad for more hints (+3 hints) -> brings total to 5 hints consumed/available in match
    s = refillAssists(s, 'hint');
    expect(s.hintsRemaining).toBe(3);
    expect(s.hintRefillsUsed).toBe(1);
    expect(s.undoRefillsUsed).toBe(0);
    // 1 refill used -> cannot refill hints again in this match
    expect(canRefillAssists(s, 'hint')).toBe(false);

    // Undo refills are still available independently (+3 undos)
    expect(canRefillAssists(s, 'undo')).toBe(true);
    s = consumeAssist(s, 'undo').next;
    expect(s.undosRemaining).toBe(0);
    s = refillAssists(s, 'undo');
    expect(s.undosRemaining).toBe(3);
    expect(s.undoRefillsUsed).toBe(1);
    // 1 undo refill used -> cannot refill undos again in this match
    expect(canRefillAssists(s, 'undo')).toBe(false);
  });

  it('enforces premium match cap without ad prompts while tracking used for stars', () => {
    let s = createMatchAssists(true);
    expect(canRefillAssists(s, 'hint')).toBe(false);
    expect(canRefillAssists(s, 'undo')).toBe(false);

    // Consume all 6 hints
    for (let i = 0; i < 6; i++) {
      expect(canUseAssist(s, 'hint')).toBe(true);
      s = consumeAssist(s, 'hint').next;
    }
    expect(s.hintsRemaining).toBe(0);
    expect(s.used).toBe(6);

    // Cannot consume a 7th hint; stays at 0 and rejects
    expect(canUseAssist(s, 'hint')).toBe(false);
    const failHint = consumeAssist(s, 'hint');
    expect(failHint.ok).toBe(false);
    expect(canRefillAssists(s, 'hint')).toBe(false);

    // Can still consume the 4 undos independently
    for (let i = 0; i < 4; i++) {
      expect(canUseAssist(s, 'undo')).toBe(true);
      s = consumeAssist(s, 'undo').next;
    }
    expect(s.undosRemaining).toBe(0);
    expect(canUseAssist(s, 'undo')).toBe(false);
    expect(consumeAssist(s, 'undo').ok).toBe(false);
    expect(canRefillAssists(s, 'undo')).toBe(false);
    expect(s.used).toBe(10);
  });

  it('consumes a hint token for successive reveal without penalizing stars (countStarLoss: false)', () => {
    let s = createMatchAssists(false); // starts with 2 hints
    expect(s.hintsRemaining).toBe(2);
    expect(s.used).toBe(0);

    // Action 1: Category clue consumes 1 hint and incurs star penalty
    s = consumeAssist(s, 'hint', { countStarLoss: true }).next;
    expect(s.hintsRemaining).toBe(1);
    expect(s.used).toBe(1);

    // Action 2: Exact move reveal consumes 1 hint BUT does not count toward star penalty
    s = consumeAssist(s, 'hint', { countStarLoss: false }).next;
    expect(s.hintsRemaining).toBe(0);
    expect(s.used).toBe(1); // used remains 1 (no extra star lost)!

    // Out of hints -> cannot consume without refill
    expect(canUseAssist(s, 'hint')).toBe(false);
    expect(consumeAssist(s, 'hint').ok).toBe(false);
  });
});
