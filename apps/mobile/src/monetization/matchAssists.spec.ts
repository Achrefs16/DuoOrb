import { describe, expect, it } from 'vitest';
import {
  createMatchAssists,
  canUseAssist,
  consumeAssist,
  canRefillAssists,
  refillAssists,
  willForfeitThreeStars,
  FREE_STARTING_ASSISTS,
  PREMIUM_STARTING_ASSISTS,
  MAX_AD_REFILLS_PER_MATCH,
} from './matchAssists';

describe('matchAssists economy', () => {
  it('initializes free tier with 1 assist', () => {
    const s = createMatchAssists(false);
    expect(s.remaining).toBe(FREE_STARTING_ASSISTS);
    expect(s.remaining).toBe(1);
    expect(s.used).toBe(0);
    expect(s.refillsUsed).toBe(0);
    expect(s.isPremium).toBe(false);
    expect(canUseAssist(s)).toBe(true);
    expect(willForfeitThreeStars(s)).toBe(true);
  });

  it('initializes premium tier with 9 assists', () => {
    const s = createMatchAssists(true);
    expect(s.remaining).toBe(PREMIUM_STARTING_ASSISTS);
    expect(s.remaining).toBe(9);
    expect(s.used).toBe(0);
    expect(s.isPremium).toBe(true);
  });

  it('consumes assists decrementing remaining and incrementing used', () => {
    let s = createMatchAssists(false);
    const step1 = consumeAssist(s);
    expect(step1.ok).toBe(true);
    s = step1.next;
    expect(s.remaining).toBe(0);
    expect(s.used).toBe(1);
    expect(willForfeitThreeStars(s)).toBe(false);

    // Cannot consume beyond 0
    const step2 = consumeAssist(s);
    expect(step2.ok).toBe(false);
    expect(step2.next.remaining).toBe(0);
    expect(step2.next.used).toBe(1);
  });

  it('handles rewarded ad refills for free tier up to 2 max refills per match', () => {
    let s = createMatchAssists(false);
    // Exhaust the 1 starting assist
    s = consumeAssist(s).next;
    expect(s.remaining).toBe(0);
    expect(canRefillAssists(s)).toBe(true);

    // Refill 1 (granted +3)
    s = refillAssists(s);
    expect(s.remaining).toBe(3);
    expect(s.refillsUsed).toBe(1);
    expect(canRefillAssists(s)).toBe(true);

    // Consume the 3 assists
    s = consumeAssist(s).next;
    s = consumeAssist(s).next;
    s = consumeAssist(s).next;
    expect(s.remaining).toBe(0);
    expect(canRefillAssists(s)).toBe(true);

    // Refill 2 (granted +3)
    s = refillAssists(s);
    expect(s.remaining).toBe(3);
    expect(s.refillsUsed).toBe(2);
    // Hits max refills (2)
    expect(canRefillAssists(s)).toBe(false);
  });

  it('allows premium users to refill up to 9 without ad cap', () => {
    let s = createMatchAssists(true);
    // Consume 4 assists
    for (let i = 0; i < 4; i++) s = consumeAssist(s).next;
    expect(s.remaining).toBe(5);
    expect(canRefillAssists(s)).toBe(true);

    s = refillAssists(s);
    expect(s.remaining).toBe(PREMIUM_STARTING_ASSISTS);
    expect(s.remaining).toBe(9);
  });
});
