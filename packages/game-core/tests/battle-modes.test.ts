import { describe, expect, it } from 'vitest';
import {
  AI_PROFILES,
  applyAction,
  createInitialState,
  getBestAction,
  hasPathToGoal,
  isLegalMove,
  isLegalWallPlacement,
} from '../src/index.js';
import type { GameMode, GameState } from '../src/types.js';

describe('Workstream 6: Multi-Mode Battle-Testing Matrix Across All 7 Modes', () => {
  const fastAI = { ...AI_PROFILES.easy, simulations: 120, timeBudgetMs: 50 };

  it('Mode 1: 2p (Classic Duel) — 0 illegal moves and completes to a winner', () => {
    let state = createInitialState({ mode: '2p', gameId: 'battle-2p' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 120) {
      const action = getBestAction(state, fastAI, 1000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const cur = state.players[state.currentPlayerIndex];
      if (action.type === 'MOVE') {
        expect(isLegalMove(state, cur.id, action.to)).toBe(true);
      } else if (action.type === 'PLACE_WALL') {
        expect(isLegalWallPlacement(state, cur.id, action.wall)).toBe(true);
      }
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).not.toBeNull();
  });

  it('Mode 2: 4p (4-Player FFA) — 0 illegal moves and finishes with placement ranking', () => {
    let state = createInitialState({ mode: '4p', gameId: 'battle-4p' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && state.placements.length === 0 && plies < 120) {
      const action = getBestAction(state, fastAI, 2000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.placements.length).toBeGreaterThanOrEqual(1);
    expect(state.placements[0].place).toBe(1);
  }, 20_000);

  it('Mode 3: race2 (2-Player Race) — completes with place === 1 recognition', () => {
    let state = createInitialState({ mode: 'race2', gameId: 'battle-race2' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 100) {
      const action = getBestAction(state, fastAI, 3000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).not.toBeNull();
  });

  it('Mode 4: race4 (4-Player Race) — multi-agent placement race completes legally', () => {
    let state = createInitialState({ mode: 'race4', gameId: 'battle-race4' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && state.placements.length === 0 && plies < 120) {
      const action = getBestAction(state, fastAI, 4000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.placements.length).toBeGreaterThanOrEqual(1);
    expect(state.placements[0].place).toBe(1);
  }, 20_000);

  it('Mode 5: center2 (2-Player Center Rush) — converges on center square', () => {
    let state = createInitialState({ mode: 'center2', gameId: 'battle-center2' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 100) {
      const action = getBestAction(state, fastAI, 5000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).not.toBeNull();
  });

  it('Mode 6: center3 (3-Player Center Rush) — converges on center square without infinite looping', () => {
    let state = createInitialState({ mode: 'center3', gameId: 'battle-center3' });
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 100) {
      const action = getBestAction(state, fastAI, 6000 + plies);
      expect(action, `ply ${plies}`).not.toBeNull();
      if (!action) break;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) break;
      state = res.state;
      plies++;
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).not.toBeNull();
  }, 20_000);

  it('Mode 7: Blitz / Fast Clock Mode — move execution strictly <= 250ms', () => {
    const state = createInitialState({ mode: '2p', gameId: 'battle-blitz' });
    const blitzProfile = { ...AI_PROFILES.normal, timeBudgetMs: 150 };
    const started = Date.now();
    const action = getBestAction(state, blitzProfile);
    const elapsed = Date.now() - started;
    expect(action).not.toBeNull();
    expect(elapsed).toBeLessThanOrEqual(250);
  });
});
