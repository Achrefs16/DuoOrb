import { describe, expect, it } from 'vitest';
import { applyAction, createInitialState } from '../src/ruleset.js';

describe('Ruleset & Game Flow', () => {
  it('initializes 2-player classic mode correctly', () => {
    const state = createInitialState({ mode: '2p' });
    expect(state.rulesetVersion).toBe('classic-2p-v1');
    expect(state.mode).toBe('2p');
    expect(state.players).toHaveLength(2);
    expect(state.players[0].position).toEqual({ row: 8, col: 4 });
    expect(state.players[0].wallsRemaining).toBe(10);
    expect(state.players[0].goalDirection).toBe('TOP');

    expect(state.players[1].position).toEqual({ row: 0, col: 4 });
    expect(state.players[1].wallsRemaining).toBe(10);
    expect(state.players[1].goalDirection).toBe('BOTTOM');

    expect(state.currentPlayerIndex).toBe(0);
    expect(state.status).toBe('IN_PROGRESS');
  });

  it('initializes 4-player classic mode correctly', () => {
    const state = createInitialState({ mode: '4p' });
    expect(state.rulesetVersion).toBe('classic-4p-v1');
    expect(state.mode).toBe('4p');
    expect(state.players).toHaveLength(4);

    expect(state.players[0].position).toEqual({ row: 8, col: 4 });
    expect(state.players[0].wallsRemaining).toBe(5);
    expect(state.players[0].goalDirection).toBe('TOP');

    expect(state.players[1].position).toEqual({ row: 0, col: 4 });
    expect(state.players[1].wallsRemaining).toBe(5);
    expect(state.players[1].goalDirection).toBe('BOTTOM');

    expect(state.players[2].position).toEqual({ row: 4, col: 0 });
    expect(state.players[2].wallsRemaining).toBe(5);
    expect(state.players[2].goalDirection).toBe('RIGHT');

    expect(state.players[3].position).toEqual({ row: 4, col: 8 });
    expect(state.players[3].wallsRemaining).toBe(5);
    expect(state.players[3].goalDirection).toBe('LEFT');
  });

  it('advances turns alternating between players in 2P', () => {
    const state = createInitialState({ mode: '2p' });

    // P1 moves to (7, 4)
    const res1 = applyAction(state, { type: 'MOVE', to: { row: 7, col: 4 } });
    expect(res1.success).toBe(true);
    if (!res1.success) return;

    expect(res1.state.currentPlayerIndex).toBe(1);
    expect(res1.state.moveNumber).toBe(2);
    expect(res1.state.players[0].position).toEqual({ row: 7, col: 4 });

    // P2 places wall
    const res2 = applyAction(res1.state, {
      type: 'PLACE_WALL',
      wall: { row: 3, col: 3, orientation: 'H' },
    });
    expect(res2.success).toBe(true);
    if (!res2.success) return;

    expect(res2.state.currentPlayerIndex).toBe(0);
    expect(res2.state.moveNumber).toBe(3);
    expect(res2.state.players[1].wallsRemaining).toBe(9);
    expect(res2.state.walls).toHaveLength(1);
  });

    it('declares victory when player reaches their target edge', () => {

    const state = createInitialState({ mode: '2p' });
    // Place P1 one step away from goal row 0
    state.players[0].position = { row: 1, col: 3 };

    const winMove = applyAction(state, { type: 'MOVE', to: { row: 0, col: 3 } });
    expect(winMove.success).toBe(true);
    if (!winMove.success) return;

    expect(winMove.state.status).toBe('COMPLETED');
    expect(winMove.state.winnerId).toBe('p1');
    expect(winMove.state.endedAt).not.toBeNull();

    // Any subsequent action must be rejected
    const extraMove = applyAction(winMove.state, { type: 'MOVE', to: { row: 1, col: 4 } });
    expect(extraMove.success).toBe(false);
    if (!extraMove.success) {
      expect(extraMove.error.code).toBe('GAME_NOT_IN_PROGRESS');
    }
  });

  it('handles resignation correctly', () => {
    const state = createInitialState({ mode: '2p' });
    const res = applyAction(state, { type: 'RESIGN' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.state.status).toBe('COMPLETED');
    expect(res.state.winnerId).toBe('p2'); // P2 wins by P1 resignation
  });

  it('guarantees state immutability', () => {
    const state = createInitialState({ mode: '2p' });
    const originalPos = { ...state.players[0].position };

    const res = applyAction(state, { type: 'MOVE', to: { row: 7, col: 4 } });
    expect(res.success).toBe(true);

    // Original state must remain unchanged
    expect(state.players[0].position).toEqual(originalPos);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.history).toHaveLength(0);
  });

  it('4p: reaching an edge cell does not win', () => {
    const state = createInitialState({ mode: '4p' });
    // P1 one step away from the middle of row 0 — not the goal anymore
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 0, col: 0 };

    const res = applyAction(state, { type: 'MOVE', to: { row: 0, col: 4 } });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.state.status).toBe('IN_PROGRESS');
    expect(res.state.winnerId).toBeNull();
  });

  it('4p: reaching the center square finishes 1st, game continues', () => {
    const state = createInitialState({ mode: '4p' });
    // P1 one step away from the center
    state.players[0].position = { row: 3, col: 4 };

    const res = applyAction(state, { type: 'MOVE', to: { row: 4, col: 4 } });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.state.status).toBe('IN_PROGRESS');
    expect(res.state.winnerId).toBeNull();
    expect(res.state.players[0].status).toBe('FINISHED');
    expect(res.state.players[0].place).toBe(1);
    expect(res.state.placements).toEqual([{ playerId: 'p1', place: 1 }]);
  });

  it('4p: side player finishes on the same center square, game continues', () => {
    const state = createInitialState({ mode: '4p' });
    // P3 one step away from the center
    state.players[2].position = { row: 4, col: 3 };
    state.currentPlayerIndex = 2;

    const res = applyAction(state, { type: 'MOVE', to: { row: 4, col: 4 } });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.state.status).toBe('IN_PROGRESS');
    expect(res.state.players[2].status).toBe('FINISHED');
    expect(res.state.players[2].place).toBe(1);
  });

  it('initializes race modes on the bottom row with a shared top goal', () => {
    const r2 = createInitialState({ mode: 'race2' });
    expect(r2.rulesetVersion).toBe('race-v1');
    expect(r2.players).toHaveLength(2);
    expect(r2.players.map((p) => p.position)).toEqual([
      { row: 8, col: 2 },
      { row: 8, col: 6 },
    ]);
    expect(r2.players.every((p) => p.goalDirection === 'TOP')).toBe(true);
    expect(r2.players[0].wallsRemaining).toBe(10);

    const r3 = createInitialState({ mode: 'race3' });
    expect(r3.players).toHaveLength(3);
    expect(r3.players.map((p) => p.position)).toEqual([
      { row: 8, col: 1 },
      { row: 8, col: 4 },
      { row: 8, col: 7 },
    ]);
    expect(r3.players.every((p) => p.goalDirection === 'TOP')).toBe(true);
    expect(r3.players[0].wallsRemaining).toBe(6);

    const r4 = createInitialState({ mode: 'race4' });
    expect(r4.players).toHaveLength(4);
    expect(r4.players.map((p) => p.position)).toEqual([
      { row: 8, col: 1 },
      { row: 8, col: 3 },
      { row: 8, col: 5 },
      { row: 8, col: 7 },
    ]);
    expect(r4.players[0].wallsRemaining).toBe(5);
  });

  it('race: any top-row cell finishes 1st, other rows do not', () => {
    const state = createInitialState({ mode: 'race3' });
    state.players[0].position = { row: 1, col: 0 };

    const win = applyAction(state, { type: 'MOVE', to: { row: 0, col: 0 } });
    expect(win.success).toBe(true);
    if (!win.success) return;
    expect(win.state.status).toBe('IN_PROGRESS');
    expect(win.state.players[0].status).toBe('FINISHED');
    expect(win.state.players[0].place).toBe(1);

    const live = createInitialState({ mode: 'race3' });
    live.players[1].position = { row: 2, col: 5 };
    live.currentPlayerIndex = 1;
    const noWin = applyAction(live, { type: 'MOVE', to: { row: 1, col: 5 } });
    expect(noWin.success).toBe(true);
    if (!noWin.success) return;
    expect(noWin.state.status).toBe('IN_PROGRESS');
  });

  it('race2: resignation hands the win to the opponent', () => {
    const state = createInitialState({ mode: 'race2' });
    const res = applyAction(state, { type: 'RESIGN' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.state.winnerId).toBe('p2');
  });

  it('initializes center2/center3 racing for the middle square', () => {
    const c2 = createInitialState({ mode: 'center2' });
    expect(c2.rulesetVersion).toBe('center-v1');
    expect(c2.players).toHaveLength(2);
    expect(c2.players.map((p) => p.position)).toEqual([
      { row: 8, col: 4 },
      { row: 0, col: 4 },
    ]);
    expect(c2.players[0].wallsRemaining).toBe(10);

    const c3 = createInitialState({ mode: 'center3' });
    expect(c3.players).toHaveLength(3);
    expect(c3.players.map((p) => p.position)).toEqual([
      { row: 8, col: 4 },
      { row: 0, col: 4 },
      { row: 4, col: 0 },
    ]);
    expect(c3.players[0].wallsRemaining).toBe(6);
  });

  it('center2 wins in the middle, edges do not', () => {
    const center = createInitialState({ mode: 'center2' });
    center.players[0].position = { row: 5, col: 4 };
    const midWin = applyAction(center, { type: 'MOVE', to: { row: 4, col: 4 } });
    expect(midWin.success).toBe(true);
    if (!midWin.success) return;
    expect(midWin.state.status).toBe('COMPLETED');

    const notYet = createInitialState({ mode: 'center2' });
    notYet.players[0].position = { row: 1, col: 4 };
    notYet.players[1].position = { row: 0, col: 0 };
    const edgeNoWin = applyAction(notYet, { type: 'MOVE', to: { row: 0, col: 4 } });
    expect(edgeNoWin.success).toBe(true);
    if (!edgeNoWin.success) return;
    expect(edgeNoWin.state.status).toBe('IN_PROGRESS');
  });

  it('center2: resignation hands the win to the opponent', () => {
    const state = createInitialState({ mode: 'center2' });
    const res = applyAction(state, { type: 'RESIGN' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.state.winnerId).toBe('p2');
  });
});
