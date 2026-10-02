import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  applyAction,
  getLegalMoves,
  type GameAction,
  type GameState,
} from '@duoorb/game-core';

/**
 * Optimistic rendering rules for online play.
 *
 * The mobile hook derives the board it draws by replaying our own
 * unconfirmed actions on top of confirmed server state. That derivation is a
 * PREDICTION: it must never claim an outcome the server has not confirmed,
 * because the whole reason it exists is that a rejected move has to look
 * reverted rather than lost.
 *
 * Pure-function level (no React): these are the exact rules the hook applies.
 */

/** Replays pending actions the way useOnlineGame's optimisticState does. */
function derive(confirmed: GameState, pending: GameAction[]): GameState {
  if (pending.length === 0) return confirmed;
  let next = confirmed;
  for (const action of pending) {
    const mover = next.players[next.currentPlayerIndex];
    if (!mover) break;
    const res = applyAction(next, action, {
      timestamp: Date.now(),
      clockRemainingMs: 0,
      actorId: mover.id,
    });
    if (!res.success) break;
    next = res.state;
  }
  if (next === confirmed) return confirmed;
  if (next.status !== 'COMPLETED') return next;
  return {
    ...next,
    status: confirmed.status,
    winnerId: confirmed.winnerId,
    players: next.players.map((p) => {
      const was = confirmed.players.find((c) => c.id === p.id);
      return { ...p, status: was?.status ?? p.status, place: was?.place ?? null };
    }),
  };
}

function freshState(): GameState {
  return createInitialState({ mode: '2p', gameId: 'g1', playerNames: ['A', 'B'] });
}

/** A legal move for whoever is on turn. */
function anyLegalMove(state: GameState): GameAction {
  const mover = state.players[state.currentPlayerIndex];
  return { type: 'MOVE', to: getLegalMoves(state, mover.id)[0] };
}

describe('optimistic board derivation', () => {
  it('is the confirmed board when nothing is in flight', () => {
    const state = freshState();
    expect(derive(state, [])).toBe(state);
  });

  it('shows our own unconfirmed move immediately', () => {
    const state = freshState();
    const target = getLegalMoves(state, state.players[state.currentPlayerIndex].id)[0];
    const derived = derive(state, [{ type: 'MOVE', to: target }]);

    const mover = state.players[state.currentPlayerIndex];
    const derivedPlayer = derived.players.find((p) => p.id === mover.id)!;
    const confirmedPlayer = state.players.find((p) => p.id === mover.id)!;

    expect(derivedPlayer.position).toEqual(target);
    // Confirmed state is untouched: the prediction lives only in the derived copy.
    expect(confirmedPlayer.position).not.toEqual(target);
  });

  it('advances the turn in the derived copy only', () => {
    const state = freshState();
    const derived = derive(state, [anyLegalMove(state)]);
    expect(derived.currentPlayerIndex).not.toBe(state.currentPlayerIndex);
    expect(state.currentPlayerIndex).toBe(0);
  });

  it('never reports COMPLETED for a predicted finish', () => {
    // Drive a real 1v1 to a winning goal move, then hold that move pending.
    let state = freshState();
    let winningMove: GameAction | null = null;
    for (let i = 0; i < 200 && !winningMove; i++) {
      const mover = state.players[state.currentPlayerIndex];
      for (const to of getLegalMoves(state, mover.id)) {
        const res = applyAction(state, { type: 'MOVE', to }, {
          timestamp: Date.now(),
          clockRemainingMs: 0,
          actorId: mover.id,
        });
        if (res.success && res.state.status === 'COMPLETED') {
          winningMove = { type: 'MOVE', to };
          break;
        }
      }
      if (winningMove) break;
      const anyTo = getLegalMoves(state, mover.id)[0];
      const res = applyAction(state, { type: 'MOVE', to: anyTo }, {
        timestamp: Date.now(),
        clockRemainingMs: 0,
        actorId: mover.id,
      });
      if (!res.success) break;
      state = res.state;
      if (state.status !== 'IN_PROGRESS') break;
    }
    expect(winningMove).not.toBeNull();

    const confirmed = state;
    const derived = derive(confirmed, [winningMove!]);

    // The board shows where the orb went...
    expect(derived.status).toBe('IN_PROGRESS');
    expect(derived.winnerId).toBe(confirmed.winnerId);
    // ...but nobody is announced as finished, and no place is handed out.
    for (const p of derived.players) {
      expect(p.status).not.toBe('FINISHED');
      expect(p.place).toBeNull();
    }
  });

  it('reverts to confirmed truth the moment the pending entry is gone', () => {
    const state = freshState();
    const action = anyLegalMove(state);
    // Rejected move: the hook clears the tail, so the derivation is a no-op.
    const afterRejection = derive(state, []);
    const mover = state.players[state.currentPlayerIndex];
    expect(afterRejection.players.find((p) => p.id === mover.id)!.position).toEqual(
      state.players.find((p) => p.id === mover.id)!.position
    );
    expect(derive(state, [action])).not.toBe(state);
    expect(afterRejection).toBe(state);
  });

  it('ignores a pending action that is illegal on the confirmed board', () => {
    const state = freshState();
    // Far corner is not adjacent to either start: rejected by the engine.
    const bogus: GameAction = { type: 'MOVE', to: { row: 8, col: 8 } };
    expect(derive(state, [bogus])).toBe(state);
  });
});