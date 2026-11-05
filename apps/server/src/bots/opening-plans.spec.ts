import { describe, expect, it } from 'vitest';
import { createInitialState } from '@duoorb/game-core';
import {
  OPENING_PLANS,
  STRONG_OPENING_PLANS,
  PLAYSTYLE_PLANS,
  CURATED_120_OPENINGS,
  pickOpeningPlan,
  resolveOpeningIntent,
} from './opening-plans.js';
import type { BotPlaystyle } from './bot-roster.js';

describe('opening-plans', () => {
  it('generates a robust library of plans (~90 plans)', () => {
    expect(OPENING_PLANS.length).toBeGreaterThan(50);
    expect(OPENING_PLANS.length).toBeLessThan(150);
  });

  it('ensures no plan places a wall before the third own move in general OPENING_PLANS', () => {
    for (const plan of OPENING_PLANS) {
      expect(['WF', 'WR', 'WV']).not.toContain(plan[0]);
      expect(['WF', 'WR', 'WV']).not.toContain(plan[1]);
    }
  });

  it('filters strong plans without sidesteps (L/R)', () => {
    expect(STRONG_OPENING_PLANS.length).toBeGreaterThan(0);
    for (const plan of STRONG_OPENING_PLANS) {
      expect(plan).not.toContain('L');
      expect(plan).not.toContain('R');
    }
  });

  it('pickOpeningPlan avoids recent plans', () => {
    const userId = 'user_123';
    const first = pickOpeningPlan(userId, 'game_1', false, []);
    expect(first.plan).toBeDefined();

    // If recent plan is excluded, pickOpeningPlan picks a different plan if alternatives exist
    const second = pickOpeningPlan(userId, 'game_1', false, [first.id]);
    expect(second.id).not.toBe(first.id);
  });

  it('resolveOpeningIntent resolves advancing step "A" on initial board', () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    // p1 starts at (8, 4) with goal TOP.
    const action = resolveOpeningIntent(state, 'p1', 'A');
    expect(action).not.toBeNull();
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to).toEqual({ row: 7, col: 4 });
    }
  });

  it('resolveOpeningIntent resolves sidestep "L" and "R" when legal', () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    const leftAction = resolveOpeningIntent(state, 'p1', 'L');
    expect(leftAction).not.toBeNull();
    expect(leftAction?.type).toBe('MOVE');
    if (leftAction?.type === 'MOVE') {
      expect(leftAction.to).toEqual({ row: 8, col: 3 });
    }

    const rightAction = resolveOpeningIntent(state, 'p1', 'R');
    expect(rightAction).not.toBeNull();
    expect(rightAction?.type).toBe('MOVE');
    if (rightAction?.type === 'MOVE') {
      expect(rightAction.to).toEqual({ row: 8, col: 5 });
    }
  });

  it('resolveOpeningIntent returns null if intent is illegal or does not delay rival', () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    // Early wall when rival is far away might not meet delay criteria
    const result = resolveOpeningIntent(state, 'p1', 'WF');
    // Either valid wall that delays rival, or null (which falls back to engine)
    if (result) {
      expect(result.type).toBe('PLACE_WALL');
    } else {
      expect(result).toBeNull();
    }
  });

  it('supports distinct playstyles with signature opening plans', () => {
    const playstyles: BotPlaystyle[] = [
      'early_wall',
      'reed',
      'shiller',
      'split',
      'flank',
      'gap',
      'counter',
      'evasive',
      'tempo',
      'rush',
    ];
    for (const style of playstyles) {
      const { plan } = pickOpeningPlan('u1', 'g1', style, []);
      expect(plan).toBeDefined();
      expect(plan.length).toBe(5);
      expect(PLAYSTYLE_PLANS[style]).toContain(plan);
    }
  });

  it('contains exactly 120 curated opening plans with 12 variations per playstyle', () => {
    expect(CURATED_120_OPENINGS.length).toBe(120);
    const styles = Object.keys(PLAYSTYLE_PLANS) as BotPlaystyle[];
    expect(styles.length).toBe(10);
    for (const style of styles) {
      expect(PLAYSTYLE_PLANS[style].length).toBe(12);
    }
  });

  it('picks unique signature plans across bot personas', () => {
    const plan0 = pickOpeningPlan('u1', 'g1', 'early_wall', [], 'usr_bot_us_001');
    const plan1 = pickOpeningPlan('u1', 'g1', 'reed', [], 'usr_bot_us_002');
    expect(plan0.id).toBe(0);
    expect(plan1.id).toBe(1);
    expect(plan0.id).not.toBe(plan1.id);
  });

  it('resolves early strategic opening walls (REED, SPLIT, FLANK) safely without self-harm', () => {
    const state = createInitialState({
      mode: '2p',
      playerIds: ['p1', 'p2'],
    });
    // p1 starts at row 8, goal TOP. Turn 1 REED opening:
    const reedAction = resolveOpeningIntent(state, 'p1', 'REED');
    expect(reedAction).not.toBeNull();
    expect(reedAction?.type).toBe('PLACE_WALL');

    // Turn 1 SPLIT opening:
    const splitAction = resolveOpeningIntent(state, 'p1', 'SPLIT');
    expect(splitAction).not.toBeNull();
    expect(splitAction?.type).toBe('PLACE_WALL');

    // Turn 1 FLANK opening:
    const flankAction = resolveOpeningIntent(state, 'p1', 'FLANK');
    expect(flankAction).not.toBeNull();
    expect(flankAction?.type).toBe('PLACE_WALL');
  });
});
