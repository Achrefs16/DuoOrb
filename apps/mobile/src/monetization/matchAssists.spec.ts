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
  it('initializes free tier with 1 hint and 1 undo separately', () => {
    const s = createMatchAssists(false);
    expect(s.hintsRemaining).toBe(FREE_STARTING_HINTS);
    expect(s.undosRemaining).toBe(FREE_STARTING_UNDOS);
    expect(s.hintsRemaining).toBe(1);
    expect(s.undosRemaining).toBe(1);
    expect(s.used).toBe(0);
    expect(s.hintRefillsUsed).toBe(0);
    expect(s.undoRefillsUsed).toBe(0);
    expect(s.isPremium).toBe(false);
    expect(canUseAssist(s, 'hint')).toBe(true);
    expect(canUseAssist(s, 'undo')).toBe(true);
    expect(willForfeitThreeStars(s)).toBe(true);
  });

  it('initializes premium tier with 9 hints and 9 undos', () => {
    const s = createMatchAssists(true);
    expect(s.hintsRemaining).toBe(PREMIUM_STARTING_HINTS);
    expect(s.undosRemaining).toBe(PREMIUM_STARTING_UNDOS);
    expect(s.hintsRemaining).toBe(9);
    expect(s.undosRemaining).toBe(9);
    expect(s.used).toBe(0);
    expect(s.isPremium).toBe(true);
  });

  it('consumes hints and undos independently while tracking total used for stars', () => {
    let s = createMatchAssists(false);

    // Spend 1 hint -> hintsRemaining becomes 0, undosRemaining stays 1
    const stepHint = consumeAssist(s, 'hint');
    expect(stepHint.ok).toBe(true);
    s = stepHint.next;
    expect(s.hintsRemaining).toBe(0);
    expect(s.undosRemaining).toBe(1);
    expect(s.used).toBe(1);
    expect(willForfeitThreeStars(s)).toBe(false);

    // Cannot consume another hint without refilling
    expect(consumeAssist(s, 'hint').ok).toBe(false);
    // But CAN still consume the 1 free undo!
    const stepUndo = consumeAssist(s, 'undo');
    expect(stepUndo.ok).toBe(true);
    s = stepUndo.next;
    expect(s.undosRemaining).toBe(0);
    expect(s.used).toBe(2);
  });

  it('handles rewarded ad refills independently for hints and undos', () => {
    let s = createMatchAssists(false);
    s = consumeAssist(s, 'hint').next;
    expect(s.hintsRemaining).toBe(0);
    expect(canRefillAssists(s, 'hint')).toBe(true);

    // Watch ad for more hint (+1 hint)
    s = refillAssists(s, 'hint');
    expect(s.hintsRemaining).toBe(1);
    expect(s.hintRefillsUsed).toBe(1);
    expect(s.undoRefillsUsed).toBe(0);

    // Exhaust and refill hint a 2nd time
    s = consumeAssist(s, 'hint').next;
    s = refillAssists(s, 'hint');
    expect(s.hintsRemaining).toBe(1);
    expect(s.hintRefillsUsed).toBe(2);
    expect(canRefillAssists(s, 'hint')).toBe(false);

    // Undo refills are still available independently
    expect(canRefillAssists(s, 'undo')).toBe(true);
    s = consumeAssist(s, 'undo').next;
    expect(s.undosRemaining).toBe(0);
    s = refillAssists(s, 'undo');
    expect(s.undosRemaining).toBe(1);
    expect(s.undoRefillsUsed).toBe(1);
  });

  it('strictly limits premium users to 9 hints and 9 undos per match with no refills', () => {
    let s = createMatchAssists(true);
    expect(canRefillAssists(s, 'hint')).toBe(false);
    expect(canRefillAssists(s, 'undo')).toBe(false);

    for (let i = 0; i < 9; i++) {
      expect(consumeAssist(s, 'hint').ok).toBe(true);
      s = consumeAssist(s, 'hint').next;
    }
    expect(s.hintsRemaining).toBe(0);
    expect(s.undosRemaining).toBe(9);
    expect(canRefillAssists(s, 'hint')).toBe(false);
  });
});
