import { describe, expect, it } from 'vitest';
import { AI_PROFILES, getBestAction } from '../src/ai.js';
import { isLegalMove } from '../src/movement.js';
import { hasPathToGoal } from '../src/pathfinding.js';
import { rebuildStateAtStep } from '../src/replay.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { isLegalWallPlacement } from '../src/walls.js';

describe('Property-Style & Invariant Verification', () => {
  it('maintains all rules, paths, turn order, and replay invariants across full automated games', () => {
    // Run multiple simulated games
    const NUM_GAMES = 3;

    for (let gameIdx = 0; gameIdx < NUM_GAMES; gameIdx++) {
      let state = createInitialState({ mode: '2p', gameId: `property-sim-${gameIdx}` });
      const initialSnapshot = JSON.parse(JSON.stringify(state));

      let moveCount = 0;
      const MAX_MOVES = 60; // Cutoff for speed

      while (state.status === 'IN_PROGRESS' && moveCount < MAX_MOVES) {
        const currentPlayer = state.players[state.currentPlayerIndex];
        const prevPlayerIndex = state.currentPlayerIndex;
        const prevMoveNumber = state.moveNumber;

        // Choose action with AI
        const profile = moveCount % 2 === 0 ? AI_PROFILES.easy : AI_PROFILES.normal;
        const action = getBestAction(state, profile);

        expect(action).not.toBeNull();
        if (!action) break;

        // INVARIANT 1: Action must be legal
        if (action.type === 'MOVE') {
          expect(isLegalMove(state, currentPlayer.id, action.to)).toBe(true);
        } else if (action.type === 'PLACE_WALL') {
          expect(isLegalWallPlacement(state, currentPlayer.id, action.wall)).toBe(true);
        }

        const result = applyAction(state, action);
        expect(result.success).toBe(true);
        if (!result.success) break;

        state = result.state;
        moveCount++;

        // INVARIANT 2: For every accepted wall or move, EVERY active player MUST have a path to their goal
        for (const player of state.players) {
          const pathExists = hasPathToGoal(player.position, player.goalDirection, state.walls, state.mode);
          expect(pathExists).toBe(true);
        }

        // INVARIANT 3: Turn must advance correctly unless game is won
        if (state.status === 'IN_PROGRESS') {
          expect(state.currentPlayerIndex).toBe((prevPlayerIndex + 1) % state.players.length);
          expect(state.moveNumber).toBe(prevMoveNumber + 1);
        }

        // INVARIANT 4: Serialization idempotency (JSON stringify -> parse preserves identical state)
        const serialized = JSON.stringify(state);
        const deserialized = JSON.parse(serialized);
        expect(deserialized.players).toEqual(state.players);
        expect(deserialized.walls).toEqual(state.walls);
        expect(deserialized.status).toBe(state.status);
      }

      // INVARIANT 5: Replay from initial state produces the exact same final state
      const rebuiltFinal = rebuildStateAtStep(initialSnapshot, state.history, state.history.length);
      expect(rebuiltFinal.players).toEqual(state.players);
      expect(rebuiltFinal.walls).toEqual(state.walls);
      expect(rebuiltFinal.winnerId).toBe(state.winnerId);
      expect(rebuiltFinal.status).toBe(state.status);
      expect(rebuiltFinal.history).toEqual(state.history);
    }
  });
});
