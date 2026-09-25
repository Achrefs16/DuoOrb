import { describe, expect, it } from 'vitest';
import {
  applyAction,
  bestRemainingPlace,
  createInitialState,
  forfeitMatch,
  isLegalMove,
  nextActiveIndex,
  shouldFinishMultiplayerGame,
  worstRemainingPlace,
} from '../src/index.js';

/** Teleport player idx next to their goal and finish with a MOVE. */
function forceGoalWin(state: ReturnType<typeof createInitialState>, playerIdx: number) {
  const s = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIdx
        ? state.mode === 'race3' || state.mode === 'race4' || state.mode === 'race2'
          ? { ...p, position: { row: 1, col: p.position.col } }
          : { ...p, position: { row: 3, col: 4 } }
        : p
    ),
    currentPlayerIndex: playerIdx,
  };
  const to =
    state.mode === 'race3' || state.mode === 'race4' || state.mode === 'race2'
      ? { row: 0, col: s.players[playerIdx].position.col }
      : { row: 4, col: 4 };
  return applyAction(s, { type: 'MOVE', to });
}

describe('Multiplayer placements', () => {
  it('1v1 regression: goal completes immediately, no placements', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 0, col: 0 };
    const res = applyAction(state, { type: 'MOVE', to: { row: 0, col: 4 } });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.state.status).toBe('COMPLETED');
    expect(res.state.winnerId).toBe('p1');
    expect(res.state.placements).toEqual([]);
  });

  it('3P: A finishes -> continues; B finishes -> C auto 3rd, completes', () => {
    let state = createInitialState({ mode: 'race3' });

    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    state = a.state;
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.players[0].status).toBe('FINISHED');
    expect(state.players[0].place).toBe(1);
    expect(state.placements).toEqual([{ playerId: 'p1', place: 1 }]);
    expect(state.players[state.currentPlayerIndex].id).toBe('p2');

    const b = forceGoalWin(state, 1);
    expect(b.success).toBe(true);
    if (!b.success) return;
    state = b.state;
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).toBe('p1');
    expect(state.players[1].place).toBe(2);
    // C never reached the goal but is auto-assigned the final place.
    expect(state.players[2].status).toBe('FINISHED');
    expect(state.players[2].place).toBe(3);
    expect(state.placements).toEqual([
      { playerId: 'p1', place: 1 },
      { playerId: 'p2', place: 2 },
      { playerId: 'p3', place: 3 },
    ]);
  });

  it('4P race: three goals complete the game, last player auto-placed', () => {
    let state = createInitialState({ mode: 'race4' });

    for (const [idx, wantPlace] of [[0, 1], [1, 2], [2, 3]] as const) {
      const r = forceGoalWin(state, idx);
      expect(r.success).toBe(true);
      if (!r.success) return;
      state = r.state;
      expect(state.players[idx].place).toBe(wantPlace);
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).toBe('p1');
    expect(state.players[3].status).toBe('FINISHED');
    expect(state.players[3].place).toBe(4);
    expect(state.placements).toEqual([
      { playerId: 'p1', place: 1 },
      { playerId: 'p2', place: 2 },
      { playerId: 'p3', place: 3 },
      { playerId: 'p4', place: 4 },
    ]);
  });

  it('center: freed goal cell is enterable, full goal flow completes', () => {
    let state = createInitialState({ mode: '4p' });
    // A reaches the center -> 1st. A's orb leaves the board: the cell is
    // free and remains a normal winning destination for everyone else.
    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    state = a.state;
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.players[0].place).toBe(1);

    // B steps into the same center cell -> 2nd; C -> 3rd; D auto 4th.
    for (const [idx, wantPlace] of [[1, 2], [2, 3]] as const) {
      state = {
        ...state,
        players: state.players.map((p, i) =>
          i === idx ? { ...p, position: { row: 3, col: 4 } } : p
        ),
        currentPlayerIndex: idx,
      };
      expect(isLegalMove(state, `p${idx + 1}`, { row: 4, col: 4 })).toBe(true);
      const r = applyAction(state, { type: 'MOVE', to: { row: 4, col: 4 } });
      expect(r.success).toBe(true);
      if (!r.success) return;
      state = r.state;
      expect(state.players[idx].status).toBe('FINISHED');
      expect(state.players[idx].place).toBe(wantPlace);
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).toBe('p1');
    expect(state.players[3].place).toBe(4);
    expect(state.placements).toEqual([
      { playerId: 'p1', place: 1 },
      { playerId: 'p2', place: 2 },
      { playerId: 'p3', place: 3 },
      { playerId: 'p4', place: 4 },
    ]);
  });

  it('turn rotation skips finished players', () => {
    let state = createInitialState({ mode: '4p' });
    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    state = a.state;

    // p1 finished: rotation from p1 must go p2 -> p3 -> p4 -> p2 ...
    expect(nextActiveIndex(state.players, 0)).toBe(1);
    expect(nextActiveIndex(state.players, 1)).toBe(2);
    expect(nextActiveIndex(state.players, 2)).toBe(3);
    expect(nextActiveIndex(state.players, 3)).toBe(1);

    // Drive real actions: six wall placements must cycle p2,p3,p4,p2,p3,p4.
    const walls = [
      { row: 0, col: 0, orientation: 'H' },
      { row: 2, col: 2, orientation: 'H' },
      { row: 4, col: 4, orientation: 'H' },
      { row: 6, col: 6, orientation: 'H' },
      { row: 1, col: 1, orientation: 'V' },
      { row: 3, col: 3, orientation: 'V' },
    ] as const;
    const seen: string[] = [];
    for (const wall of walls) {
      seen.push(state.players[state.currentPlayerIndex].id);
      const r = applyAction(state, { type: 'PLACE_WALL', wall: { ...wall } });
      expect(r.success).toBe(true);
      if (!r.success) return;
      state = r.state;
    }
    expect(seen).toEqual(['p2', 'p3', 'p4', 'p2', 'p3', 'p4']);
  });

  it('forfeit takes the worst remaining place, game continues', () => {
    let state = createInitialState({ mode: 'race4' });
    // B resigns first (off-turn actor) -> worst place (4th).
    const r = applyAction(state, { type: 'RESIGN' }, { actorId: 'p2' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    state = r.state;
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.players[1].status).toBe('FINISHED');
    expect(state.players[1].place).toBe(4);

    // A and C reach the goal -> 1st and 2nd; D auto-takes 3rd.
    const g1 = forceGoalWin(state, 0);
    expect(g1.success).toBe(true);
    if (!g1.success) return;
    const g2 = forceGoalWin(g1.state, 2);
    expect(g2.success).toBe(true);
    if (!g2.success) return;
    state = g2.state;
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).toBe('p1');
    expect(state.players[3].place).toBe(3);
  });

  it('finished player cannot resign as active', () => {
    let state = createInitialState({ mode: 'race3' });
    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    state = a.state;
    const r = applyAction(state, { type: 'RESIGN' }, { actorId: 'p1' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('ALREADY_FINISHED');
  });

  it('race: freed goal cell is enterable and wins for the next player', () => {
    let state = createInitialState({ mode: 'race4' });
    // A finishes at (0,1) -> 1st. A's orb leaves the board entirely:
    // no blocking, no jumping required, the cell stays a normal goal.
    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    state = a.state;
    expect(state.players[0].position).toEqual({ row: 0, col: 1 });
    expect(state.players[0].status).toBe('FINISHED');

    // B walks directly into the freed cell and finishes 2nd from it.
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, position: { row: 1, col: 1 } } : p
      ),
      currentPlayerIndex: 1,
    };
    expect(isLegalMove(state, 'p2', { row: 0, col: 1 })).toBe(true);
    const enter = applyAction(state, { type: 'MOVE', to: { row: 0, col: 1 } });
    expect(enter.success).toBe(true);
    if (!enter.success) return;
    expect(enter.state.players[1].status).toBe('FINISHED');
    expect(enter.state.players[1].place).toBe(2);
    expect(enter.state.status).toBe('IN_PROGRESS');
  });

  it('finished mid-board orb no longer blocks movement', () => {
    let state = createInitialState({ mode: 'race4' });
    // B forfeits mid-board: its cell becomes walkable for everyone.
    const r = applyAction(state, { type: 'RESIGN' }, { actorId: 'p2' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    state = r.state;
    const bPos = state.players[1].position;
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: { row: bPos.row - 1, col: bPos.col } } : p
      ),
      currentPlayerIndex: 0,
    };
    expect(isLegalMove(state, 'p1', bPos)).toBe(true);
  });

  it('shouldFinishMultiplayerGame follows N-1 rule', () => {
    const s3 = createInitialState({ mode: 'race3' });
    expect(shouldFinishMultiplayerGame(s3)).toBe(false);
    expect(
      shouldFinishMultiplayerGame({ ...s3, placements: [{ playerId: 'p1', place: 1 }] })
    ).toBe(false);
    expect(
      shouldFinishMultiplayerGame({
        ...s3,
        placements: [
          { playerId: 'p1', place: 1 },
          { playerId: 'p2', place: 2 },
        ],
      })
    ).toBe(true);

    const s2 = createInitialState({ mode: '2p' });
    expect(shouldFinishMultiplayerGame(s2)).toBe(false);
    expect(bestRemainingPlace(s3)).toBe(1);
    expect(worstRemainingPlace(s3)).toBe(3);
  });

  it('forfeitMatch: 1v1 resignation ends immediately as a loss', () => {
    const state = createInitialState({ mode: '2p' });
    const res = forfeitMatch(state, 'p1');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.state.status).toBe('COMPLETED');
    expect(res.state.winnerId).toBe('p2');
  });

  it('forfeitMatch: multiplayer resignation finalizes at once, resigner last', () => {
    const state = createInitialState({ mode: 'race4' });
    const res = forfeitMatch(state, 'p1');
    expect(res.success).toBe(true);
    if (!res.success) return;
    // Human took the worst place; AIs forfeited after; last one standing wins.
    expect(res.state.status).toBe('COMPLETED');
    expect(res.state.players[0].place).toBe(4);
    expect(res.state.players[1].place).toBe(3);
    expect(res.state.players[2].place).toBe(2);
    expect(res.state.players[3].place).toBe(1);
    expect(res.state.winnerId).toBe('p4');
    expect(res.state.placements).toHaveLength(4);
  });

  it('forfeitMatch: already-finished resigner is rejected', () => {
    let state = createInitialState({ mode: 'race3' });
    const a = forceGoalWin(state, 0);
    expect(a.success).toBe(true);
    if (!a.success) return;
    const res = forfeitMatch(a.state, 'p1');
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.code).toBe('ALREADY_FINISHED');
  });
});
