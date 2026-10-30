import { describe, expect, it } from 'vitest';
import {
  createReplaySession,
  rebuildStateAtStep,
  replayFirst,
  replayJumpTo,
  replayNext,
  replayPrevious,
} from '../src/replay.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { parseGame, rebuildFromNotation, serializeGameRecord } from '../src/notation.js';

describe('Deterministic Replay Engine', () => {
  it('reconstructs the exact final state from recorded actions (live === replay)', () => {
    let state = createInitialState({ mode: '2p' });

    // Play a sequence of moves and walls
    const moves = [
      { type: 'MOVE', to: { row: 7, col: 4 } }, // P1
      { type: 'MOVE', to: { row: 1, col: 4 } }, // P2
      { type: 'PLACE_WALL', wall: { row: 4, col: 4, orientation: 'H' as const } }, // P1
      { type: 'MOVE', to: { row: 2, col: 4 } }, // P2
      { type: 'MOVE', to: { row: 6, col: 4 } }, // P1
    ];

    for (const action of moves) {
      const res = applyAction(state, action as any);
      expect(res.success).toBe(true);
      if (res.success) state = res.state;
    }

    // Now rebuild from initial state and action history
    const initialState = createInitialState({ mode: '2p' });
    const rebuiltFinalState = rebuildStateAtStep(initialState, state.history, state.history.length);

    expect(rebuiltFinalState.players).toEqual(state.players);
    expect(rebuiltFinalState.walls).toEqual(state.walls);
    expect(rebuiltFinalState.currentPlayerIndex).toBe(state.currentPlayerIndex);
    expect(rebuiltFinalState.moveNumber).toBe(state.moveNumber);
    expect(rebuiltFinalState.status).toBe(state.status);
    expect(rebuiltFinalState.history).toEqual(state.history);
  });

  it('navigates through replay session with PREVIOUS, NEXT, FIRST, and LAST', () => {
    let liveState = createInitialState({ mode: '2p' });
    const moves = [
      { type: 'MOVE', to: { row: 7, col: 4 } },
      { type: 'MOVE', to: { row: 1, col: 4 } },
      { type: 'MOVE', to: { row: 6, col: 4 } },
    ];

    for (const m of moves) {
      const res = applyAction(liveState, m as any);
      if (res.success) liveState = res.state;
    }

    const initialState = createInitialState({ mode: '2p' });
    let session = createReplaySession(initialState, liveState.history);

    expect(session.currentStep).toBe(3);
    expect(session.currentState.players[0].position).toEqual({ row: 6, col: 4 });

    // Step back
    session = replayPrevious(session);
    expect(session.currentStep).toBe(2);
    expect(session.currentState.players[0].position).toEqual({ row: 7, col: 4 });

    // Step back again
    session = replayPrevious(session);
    expect(session.currentStep).toBe(1);
    expect(session.currentState.players[1].position).toEqual({ row: 0, col: 4 });

    // Go to first (step 0)
    session = replayFirst(session);
    expect(session.currentStep).toBe(0);
    expect(session.currentState.players[0].position).toEqual({ row: 8, col: 4 });

    // Jump to step 2
    session = replayJumpTo(session, 2);
    expect(session.currentStep).toBe(2);
    expect(session.currentState.players[0].position).toEqual({ row: 7, col: 4 });

    // Step forward
    session = replayNext(session);
    expect(session.currentStep).toBe(3);
    expect(session.currentState.players[0].position).toEqual({ row: 6, col: 4 });
  });

  it('serializes game record with notation and moves JSON, parsed cleanly by rebuildFromNotation', () => {
    let state = createInitialState({ mode: '2p', playerNames: ['Achraf', 'Milo'] });
    const moves = [
      { type: 'MOVE', to: { row: 7, col: 4 } }, // P1: e8
      { type: 'MOVE', to: { row: 1, col: 4 } }, // P2: e2
      { type: 'PLACE_WALL', wall: { row: 4, col: 4, orientation: 'H' as const } }, // P1: He5
    ];

    for (const action of moves) {
      const res = applyAction(state, action as any);
      expect(res.success).toBe(true);
      if (res.success) state = res.state;
    }

    const exported = serializeGameRecord(state);
    expect(exported).toContain('DuoOrb 2p');
    expect(exported).toContain('Be8 (p1)');
    expect(exported).toContain('Re2 (p2)');
    expect(exported).toContain('He5 (p1)');
    expect(exported).toContain('# Moves JSON:');

    // Parse the exported string back into moves
    const parsed = parseGame(exported);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].action).toEqual({ type: 'MOVE', to: { row: 7, col: 4 } });
    expect(parsed[1].action).toEqual({ type: 'MOVE', to: { row: 1, col: 4 } });
    expect(parsed[2].action).toEqual({
      type: 'PLACE_WALL',
      wall: { row: 4, col: 4, orientation: 'H' },
    });

    const initialState = createInitialState({ mode: '2p' });
    const rebuilt = rebuildFromNotation(initialState, exported);
    expect(rebuilt.problem).toBeNull();
    expect(rebuilt.state.history).toHaveLength(3);
  });
});
