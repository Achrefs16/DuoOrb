import { describe, expect, it } from 'vitest';
import type { GameState, WallCoord } from '../src/types.js';
import { createInitialState, applyAction } from '../src/ruleset.js';
import { getShortestDistance, getLegalWalls, hasPathToGoal } from '../src/index.js';
import { getLegalMoves } from '../src/movement.js';
import { getBestActionAsync, AI_PROFILES } from '../src/ai.js';
import { mctsBestAction, mctsStats } from '../src/mcts.js';

const H = (row: number, col: number): WallCoord => ({ row, col, orientation: 'H' });
const V = (row: number, col: number): WallCoord => ({ row, col, orientation: 'V' });

/** Two-player position with explicit pawns and walls. */
function duel(p0: Cell, p1: Cell, walls: WallCoord[] = [], turn: 0 | 1 = 0): GameState {
  const s = createInitialState({ mode: '2p', gameId: 'enclosure' });
  return {
    ...s,
    players: [
      { ...s.players[0], position: p0, wallsRemaining: 10 },
      { ...s.players[1], position: p1, wallsRemaining: 10 },
    ],
    walls,
    currentPlayerIndex: turn,
  } as GameState;
}
type Cell = { row: number; col: number };

/** Largest legal increase in the opponent's shortest distance. */
function maxDenial(st: GameState): { deny: number; wall: WallCoord | null } {
  const me = st.players[st.currentPlayerIndex];
  const foe = st.players[1 - st.currentPlayerIndex];
  const base = getShortestDistance(foe.position, foe.goalDirection, st.walls, st.mode);
  let best = -Infinity;
  let wall: WallCoord | null = null;
  for (const w of getLegalWalls(st, me.id)) {
    const d = getShortestDistance(foe.position, foe.goalDirection, [...st.walls, w], st.mode);
    if (d > best) {
      best = d;
      wall = w;
    }
  }
  return { deny: best - base, wall };
}

const P = (AI_PROFILES as Record<string, { timeBudgetMs: number; maxDepth: number; noise: number }>).hard;
const think = (st: GameState, seed = 42) => getBestActionAsync(st, P as never, seed, { maxDepth: 7 });

/**
 * Enclosure / funnel positions. Quoridor is decided by who builds and who
 * dodges a cage, so these assert intent, not a specific move: denial quality,
 * never self-sealing, and never blocking when simply running already wins.
 */
describe('enclosure positions', () => {
  it('spends a wall to flip a lost race (denial is mandatory to win)', async () => {
    const st = duel({ row: 7, col: 4 }, { row: 0, col: 0 }, [H(6, 3), H(6, 4), H(6, 5), V(6, 5)]);
    const me = st.players[0];
    const foe = st.players[1];
    const meD = getShortestDistance(me.position, me.goalDirection, st.walls, st.mode);
    const foeD = getShortestDistance(foe.position, foe.goalDirection, st.walls, st.mode);
    // Precondition: behind in the race, and a legal denial exists that recovers it.
    expect(foeD).toBeLessThan(meD);
    const md = maxDenial(st);
    expect(md.deny).toBeGreaterThanOrEqual(foeD - meD + 1);

    const a = await think(st);
    expect(a?.type).toBe('PLACE_WALL');
    if (a?.type !== 'PLACE_WALL') return;
    const denied = getShortestDistance(foe.position, foe.goalDirection, [...st.walls, a.wall], st.mode) - foeD;
    expect(denied).toBe(md.deny);
  });

  it('takes the maximum denial available against a rival', async () => {
    const st = duel({ row: 8, col: 3 }, { row: 0, col: 8 }, [H(7, 4), H(7, 5), H(7, 6), V(7, 6)]);
    const foe = st.players[1];
    const foeD = getShortestDistance(foe.position, foe.goalDirection, st.walls, st.mode);
    const md = maxDenial(st);
    expect(md.deny).toBeGreaterThanOrEqual(3);

    const a = await think(st);
    if (a?.type !== 'PLACE_WALL') {
      // Moving is only acceptable if the race is already won without a wall.
      const meD = getShortestDistance(st.players[0].position, st.players[0].goalDirection, st.walls, st.mode);
      expect(meD).toBeLessThanOrEqual(foeD);
      return;
    }
    const denied = getShortestDistance(foe.position, foe.goalDirection, [...st.walls, a.wall], st.mode) - foeD;
    expect(denied).toBe(md.deny);
  });

  it('runs instead of blocking when the race is already won', async () => {
    // Both need 5; P0 moves first, so advancing wins. Best wall only adds 1
    // step of denial, which cannot change the outcome.
    const st = duel({ row: 4, col: 2 }, { row: 4, col: 5 }, [H(3, 2), H(4, 2), V(4, 3)]);
    const me = st.players[0];
    const foe = st.players[1];
    const meD = getShortestDistance(me.position, me.goalDirection, st.walls, st.mode);
    const foeD = getShortestDistance(foe.position, foe.goalDirection, st.walls, st.mode);
    expect(meD).toBeGreaterThanOrEqual(foeD);
    expect(maxDenial(st).deny).toBeLessThanOrEqual(1);

    const a = await think(st);
    expect(a?.type).toBe('MOVE');
    if (a?.type !== 'MOVE') return;
    // The advance must actually keep the winning race.
    const after = getShortestDistance(a.to, me.goalDirection, st.walls, st.mode);
    expect(after).toBeLessThanOrEqual(foeD);
  });

  it('takes an immediate win rather than setting up anything', async () => {
    const st = duel({ row: 1, col: 4 }, { row: 4, col: 4 });
    const a = await think(st);
    expect(a).toEqual({ type: 'MOVE', to: { row: 0, col: 4 } });
    const applied = applyAction(st, a!);
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    expect(applied.state.status).toBe('COMPLETED');
    expect(applied.state.winnerId).toBe(st.players[0].id);
  });

  it('never seals itself in, on any enclosure position', async () => {
    const positions: GameState[] = [
      duel({ row: 7, col: 4 }, { row: 0, col: 0 }, [H(6, 3), H(6, 4), H(6, 5), V(6, 5)]),
      duel({ row: 8, col: 3 }, { row: 0, col: 8 }, [H(7, 4), H(7, 5), H(7, 6), V(7, 6)]),
      duel({ row: 4, col: 2 }, { row: 4, col: 5 }, [H(3, 2), H(4, 2), V(4, 3)]),
      duel({ row: 6, col: 6 }, { row: 2, col: 2 }, [H(5, 5), H(5, 6), H(5, 7), V(5, 7)]),
      duel({ row: 4, col: 4 }, { row: 4, col: 4 }),
      duel({ row: 1, col: 7 }, { row: 7, col: 1 }),
      duel({ row: 2, col: 6 }, { row: 6, col: 2 }, [H(1, 5)]),
      duel({ row: 6, col: 0 }, { row: 0, col: 4 }, [H(5, 0), V(5, 0)]),
    ];
    for (const st of positions) {
      const me = st.players[st.currentPlayerIndex];
      const a = await think(st);
      expect(a).not.toBeNull();
      if (!a) continue;
      const applied = applyAction(st, a);
      expect(applied.success).toBe(true);
      if (!applied.success) continue;
      if (a.type === 'PLACE_WALL') {
        // The wall must leave its owner a route, i.e. not a suicide move.
        expect(hasPathToGoal(me.position, me.goalDirection, applied.state.walls, st.mode)).toBe(true);
      } else {
        expect(getLegalMoves(st, me.id).some((m) => m.row === a.to.row && m.col === a.to.col)).toBe(true);
      }
    }
  });
});

/**
 * Four-player mode races every seat to the single centre square, so the
 * whole game is one funnel: caging a rival next to (4,4) is the decisive
 * play, and finishing only locks that seat's place while others continue.
 */
describe('enclosure positions (4p centre race)', () => {
  function table(pawns: Cell[], walls: WallCoord[] = [], turn = 0): GameState {
    const s = createInitialState({ mode: '4p', gameId: 'enclosure-4p' });
    return {
      ...s,
      players: s.players.map((p, i) => ({ ...p, position: pawns[i], wallsRemaining: 5 })),
      walls,
      currentPlayerIndex: turn,
    } as GameState;
  }
  const dist = (st: GameState, i: number): number => {
    const p = st.players[i];
    return getShortestDistance(p.position, p.goalDirection, st.walls, st.mode);
  };
  const think4 = (st: GameState, seed = 42) =>
    getBestActionAsync(st, P as never, seed, { maxDepth: 6 });

  it('takes the centre when one step away', async () => {
    const st = table([
      { row: 5, col: 4 },
      { row: 3, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 6 },
    ]);
    expect(dist(st, 0)).toBe(1);
    const a = await think4(st);
    expect(a).toEqual({ type: 'MOVE', to: { row: 4, col: 4 } });
    const applied = applyAction(st, a!);
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    // 4p is a placement race: the finisher is locked at 1st, game continues.
    expect(applied.state.status).toBe('IN_PROGRESS');
    expect(applied.state.players[0].place).toBe(1);
  });

  it('still chases the centre for second place after the first seat finishes', async () => {
    let st = table([
      { row: 4, col: 4 },
      { row: 2, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 6 },
    ]);
    const first = applyAction(st, { type: 'MOVE', to: { row: 3, col: 4 } });
    expect(first.success).toBe(true);
    if (!first.success) return;
    // P0 walks in from (4,4) is impossible; simulate P0 already placed.
    st = { ...first.state, players: first.state.players.map((p, i) => (i === 0 ? { ...p, place: 1 } : p)) };
    const p1Turn = { ...st, currentPlayerIndex: 1 } as GameState;
    const a = await think4(p1Turn);
    expect(a).not.toBeNull();
    expect(applyAction(p1Turn, a!).success).toBe(true);
  });

  it('never cages itself in on the way to the centre', async () => {
    const positions: GameState[] = [
      table([
        { row: 6, col: 4 },
        { row: 2, col: 4 },
        { row: 4, col: 1 },
        { row: 4, col: 6 },
      ]),
      table(
        [
          { row: 6, col: 4 },
          { row: 3, col: 4 },
          { row: 4, col: 2 },
          { row: 4, col: 6 },
        ],
        [H(5, 3), H(5, 4), H(5, 5)]
      ),
      table([
        { row: 8, col: 4 },
        { row: 0, col: 4 },
        { row: 4, col: 0 },
        { row: 4, col: 8 },
      ]),
    ];
    for (const st of positions) {
      expect(st.players.some((p) => dist(st, p.index) === Infinity)).toBe(false);
      const me = st.players[st.currentPlayerIndex];
      const a = await think4(st);
      expect(a).not.toBeNull();
      if (!a) continue;
      const applied = applyAction(st, a);
      expect(applied.success).toBe(true);
      if (!applied.success) continue;
      if (a.type === 'PLACE_WALL') {
        expect(hasPathToGoal(me.position, me.goalDirection, applied.state.walls, st.mode)).toBe(true);
      }
    }
  });
});

/** The MCTS sparring engine has to be a trustworthy measuring stick. */describe('mcts engine', () => {
  const spot: GameState = duel({ row: 7, col: 4 }, { row: 0, col: 0 }, [H(6, 3), H(6, 4), H(6, 5), V(6, 5)]);

  it('returns a legal move and respects its simulation budget', () => {
    const a = mctsBestAction(spot, { simulations: 400, seed: 5 });
    const st = mctsStats();
    expect(a).not.toBeNull();
    expect(applyAction(spot, a!).success).toBe(true);
    expect(st.simulations).toBe(400);
    expect(st.nodes).toBeGreaterThan(1);
  });

  it('is deterministic for a given seed and varies without one', () => {
    const a = mctsBestAction(spot, { simulations: 800, seed: 11 });
    const b = mctsBestAction(spot, { simulations: 800, seed: 11 });
    expect(a).toEqual(b);
  });

  it('concentrates visits instead of spreading them over every wall slot', () => {
    // Regression: a radius-2 wall sweep gave ~200 root children, so the best
    // child got ~1% of simulations and the search was a lottery.
    mctsBestAction(spot, { simulations: 2000, seed: 3 });
    const st = mctsStats();
    expect(st.bestVisits / st.simulations).toBeGreaterThan(0.05);
  });

  it('converges on an equally-good symmetric opening choice', () => {
    const s = createInitialState({ mode: '2p', gameId: 'open' });
    const a = mctsBestAction(s, { simulations: 2000, seed: 7 });
    expect(a).not.toBeNull();
    expect(applyAction(s, a!).success).toBe(true);
  });
});
