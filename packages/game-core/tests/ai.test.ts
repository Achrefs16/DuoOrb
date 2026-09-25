import { describe, expect, it } from 'vitest';
import { AI_PROFILES, evaluateState, getBestAction, repetitionPenalty, shortestPathStep } from '../src/ai.js';
import { isLegalMove } from '../src/movement.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { getShortestDistance } from '../src/pathfinding.js';
import { GameState, RecordedAction } from '../src/index.js';
import { isLegalWallPlacement } from '../src/walls.js';

describe('AI Engine', () => {
  it('evaluates starting board state as balanced (score close to 0)', () => {
    const state = createInitialState({ mode: '2p' });
    const p1Eval = evaluateState(state, 'p1', AI_PROFILES.normal);
    // Both players start with equal distance to goal (8 steps) and 10 walls
    expect(p1Eval).toBe(0);
  });

  it('generates strictly legal moves for all difficulty levels', () => {
    const state = createInitialState({ mode: '2p' });

    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const profile = AI_PROFILES[difficulty];
      const action = getBestAction(state, profile);
      expect(action).not.toBeNull();

      if (action) {
        if (action.type === 'MOVE') {
          expect(isLegalMove(state, 'p1', action.to)).toBe(true);
        } else if (action.type === 'PLACE_WALL') {
          expect(isLegalWallPlacement(state, 'p1', action.wall)).toBe(true);
        }

        // Applying the AI action must succeed
        const res = applyAction(state, action);
        expect(res.success).toBe(true);
      }
    }
  });

  it('AI chooses winning move when one step away from goal', () => {
    const state = createInitialState({ mode: '2p' });
    // Place P1 at (1, 4) - 1 step from row 0
    state.players[0].position = { row: 1, col: 4 };

    const action = getBestAction(state, AI_PROFILES.normal);
    expect(action).not.toBeNull();
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to.row).toBe(0); // Takes the winning square!
    }
  });

  it('penalizes undoing the last move but never a winning move', () => {
    const state = createInitialState({ mode: '2p' });
    // AI (p2) stands on (2,4); previously went (0,4) -> (1,4) -> (2,4).
    state.players[1].position = { row: 2, col: 4 };
    state.currentPlayerIndex = 1;
    const mk = (seq: number, to: { row: number; col: number }): RecordedAction => ({
      sequence: seq,
      playerId: 'p2',
      action: { type: 'MOVE', to },
      timestamp: seq,
    });
    state.history = [mk(1, { row: 0, col: 4 }), mk(2, { row: 1, col: 4 }), mk(3, { row: 2, col: 4 })];

    // Direct reversal back to (1,4): hard penalty.
    expect(repetitionPenalty(state, 'p2', { row: 1, col: 4 })).toBe(6);
    // Older revisit (0,4): softer penalty.
    expect(repetitionPenalty(state, 'p2', { row: 0, col: 4 })).toBe(3);
    // Fresh square: no penalty.
    expect(repetitionPenalty(state, 'p2', { row: 3, col: 4 })).toBe(0);
    // Unknown player: no penalty.
    expect(repetitionPenalty(state, 'nobody', { row: 1, col: 4 })).toBe(0);
  });

  it('catches wider pacing loops with a fading memory', () => {
    const state = createInitialState({ mode: '2p' });
    // AI (p2) trail newest-first: (3,3) -> (2,3) -> (2,4) -> (1,4) -> (0,4).
    state.players[1].position = { row: 3, col: 3 };
    state.currentPlayerIndex = 1;
    const mk = (seq: number, to: { row: number; col: number }): RecordedAction => ({
      sequence: seq,
      playerId: 'p2',
      action: { type: 'MOVE', to },
      timestamp: seq,
    });
    state.history = [
      mk(1, { row: 0, col: 4 }),
      mk(2, { row: 1, col: 4 }),
      mk(3, { row: 2, col: 4 }),
      mk(4, { row: 2, col: 3 }),
      mk(5, { row: 3, col: 3 }),
    ];

    expect(repetitionPenalty(state, 'p2', { row: 2, col: 3 })).toBe(6);
    expect(repetitionPenalty(state, 'p2', { row: 2, col: 4 })).toBe(3);
    expect(repetitionPenalty(state, 'p2', { row: 1, col: 4 })).toBe(1);
    expect(repetitionPenalty(state, 'p2', { row: 0, col: 4 })).toBe(1);
    expect(repetitionPenalty(state, 'p2', { row: 4, col: 3 })).toBe(0);
  });

  it('AI does not shuffle back when a forward move exists', () => {
    const state = createInitialState({ mode: '2p' });
    // AI (p2) on (2,4) heading down; last move was (1,4) -> (2,4).
    // No walls left, so it must march: forward, never back.
    state.players[0].position = { row: 7, col: 0 };
    state.players[1].position = { row: 2, col: 4 };
    state.players[1].wallsRemaining = 0;
    state.currentPlayerIndex = 1;
    const mk = (
      seq: number,
      playerId: string,
      to: { row: number; col: number }
    ): RecordedAction => ({
      sequence: seq,
      playerId,
      action: { type: 'MOVE', to },
      timestamp: seq,
    });
    state.history = [
      mk(1, 'p1', { row: 7, col: 4 }),
      mk(2, 'p2', { row: 1, col: 4 }),
      mk(3, 'p1', { row: 7, col: 0 }),
      mk(4, 'p2', { row: 2, col: 4 }),
    ];

    const steady = { ...AI_PROFILES.normal, randomness: 0 };
    for (let i = 0; i < 5; i++) {
      const action = getBestAction(state, steady);
      expect(action?.type).toBe('MOVE');
      if (action?.type === 'MOVE') {
        // Must keep marching forward, never step back to (1,4).
        expect(action.to).toEqual({ row: 3, col: 4 });
      }
    }
  });

  it('follows the optimal shortest path around a wall', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 2, col: 4 };
    state.players[1].wallsRemaining = 0;
    state.currentPlayerIndex = 1;
    // Horizontal wall directly ahead blocks (2,3)->(3,3) and (2,4)->(3,4).
    state.walls = [
      { row: 2, col: 3, orientation: 'H', placedByPlayerId: 'p1', sequence: 1 },
    ];

    // Optimal detour goes right around the wall edge.
    expect(shortestPathStep(state, 'p2')).toEqual({ row: 2, col: 5 });

    const steady = { ...AI_PROFILES.normal, randomness: 0 };
    const action = getBestAction(state, steady);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to).toEqual({ row: 2, col: 5 });
    }
  });

  it('runs its own race instead of walling when clearly behind', () => {
    const state = createInitialState({ mode: 'race4' });
    // Leader p1 close to the top; AI p2 far behind at its start.
    state.players[0].position = { row: 3, col: 1 };
    state.players[1].position = { row: 7, col: 3 };
    state.currentPlayerIndex = 1;

    const steady = { ...AI_PROFILES.normal, randomness: 0 };
    const action = getBestAction(state, steady);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      // Marches forward along its column instead of throwing a wall.
      expect(action.to).toEqual({ row: 6, col: 3 });
    }
  });

  it('blocks a leader who is one step from winning despite the deficit', () => {
    const state = createInitialState({ mode: 'race4' });
    state.players[0].position = { row: 1, col: 1 };
    state.players[1].position = { row: 7, col: 3 };
    state.currentPlayerIndex = 1;

    const steady = { ...AI_PROFILES.normal, randomness: 0 };
    const action = getBestAction(state, steady);
    expect(action?.type).toBe('PLACE_WALL');
    if (action?.type === 'PLACE_WALL') {
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) return;
      const p1 = res.state.players[0];
      expect(
        getShortestDistance(p1.position, p1.goalDirection, res.state.walls, 'race4')
      ).toBeGreaterThan(1);
    }
  });

  it('breaks the opponent plan by walling their finishing square', () => {
    const state = createInitialState({ mode: '2p' });
    // P1 (goal: TOP row) one step from winning at (0,5); AI (p2) to move.
    state.players[0].position = { row: 1, col: 5 };
    state.players[1].position = { row: 3, col: 4 };
    state.currentPlayerIndex = 1;

    const steady = { ...AI_PROFILES.normal, randomness: 0 };
    const action = getBestAction(state, steady);
    expect(action?.type).toBe('PLACE_WALL');
    if (action?.type === 'PLACE_WALL') {
      // The wall must actually slow P1 down (was 1 step away).
      const before = 1;
      const res = applyAction(state, action);
      expect(res.success).toBe(true);
      if (!res.success) return;
      const p1 = res.state.players[0];
      expect(
        getShortestDistance(p1.position, p1.goalDirection, res.state.walls, '2p')
      ).toBeGreaterThan(before);
    }
  });
});
