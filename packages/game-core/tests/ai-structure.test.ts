import { describe, expect, it } from 'vitest';
import { buildWallIndex, doesWallConflict } from '../src/geometry.js';
import {
  beginEpoch,
  boardOf,
  buildWallField,
  computeRegions,
  packSlot,
  roomScore,
  routeOf,
  slotConflicts,
  unpackSlot,
  wallSetKey,
} from '../src/ai-structure.js';
import { createInitialState } from '../src/ruleset.js';
import { GameState, WallCoord } from '../src/types.js';

const h = (row: number, col: number): WallCoord => ({ row, col, orientation: 'H' });
const v = (row: number, col: number): WallCoord => ({ row, col, orientation: 'V' });
const slotName = (w: WallCoord) => `${w.row},${w.col},${w.orientation}`;

function board(state: GameState) {
  beginEpoch();
  return boardOf(state);
}

function route(state: GameState, index = 0) {
  beginEpoch();
  return routeOf(state, boardOf(state), state.players[index]);
}

describe('wall field: chains, ends, turns, extensions, bridges', () => {
  it('reads an empty board as no chains at all', () => {
    const field = buildWallField([]);
    expect(field.chains).toHaveLength(0);
    expect(field.extensions).toHaveLength(0);
    expect(field.bridges).toHaveLength(0);
    expect(field.turnExtensions.size).toBe(0);
  });

  it('joins collinear walls into one chain with two free ends', () => {
    // h(4,3) and h(4,4) share the lattice point (4,4): one horizontal run.
    const field = buildWallField([h(4, 3), h(4, 4)]);
    expect(field.chains).toHaveLength(1);
    expect(field.chains[0].slots).toHaveLength(2);
    expect(field.chains[0].closed).toBe(false);
    expect(field.chains[0].ends).toHaveLength(2);
    expect(field.chains[0].turns).toBe(0);
  });

  it('counts a perpendicular join as a turn', () => {
    // v(4,5) meets h(4,4) at lattice (4,5) and touches nothing else.
    const field = buildWallField([h(4, 3), h(4, 4), v(4, 5)]);
    expect(field.chains).toHaveLength(1);
    expect(field.chains[0].turns).toBe(1);
    // The free slot that would turn the chain at the same corner.
    expect(field.turnExtensions.has('3,5,V')).toBe(true);
  });

  it('keeps walls that do not share a lattice point in separate chains', () => {
    // h(4,3) spans lattice (4,3)-(4,4). h(5,3) spans (5,3)-(5,4): no overlap.
    const field = buildWallField([h(4, 3), h(5, 3)]);
    expect(field.chains).toHaveLength(2);
  });

  it('finds the slots that would continue a chain', () => {
    const field = buildWallField([h(4, 3), h(4, 4)]);
    const keys = field.extensions.map(slotName);
    expect(keys).toContain('4,5,H');
    expect(keys).toContain('4,2,H');
    // And the perpendicular ones, which would turn it instead.
    expect(keys).toContain('4,5,V');
  });

  it('detects a slot that would bridge two chains', () => {
    // Two parallel runs one lattice unit apart. v(3,5) touches both of them and
    // crosses nothing, so it is a legal merge.
    const field = buildWallField([h(3, 3), h(3, 4), h(4, 3), h(4, 4)]);
    expect(field.chains).toHaveLength(2);
    expect(field.bridges.map(slotName)).toContain('3,5,V');
    expect(field.chainTouch.get('3,5,V')).toBe(2);
  });

  it('treats the wall set as unordered so equal boards share a key', () => {
    expect(wallSetKey([h(4, 3), h(1, 1)])).toBe(wallSetKey([h(1, 1), h(4, 3)]));
    expect(wallSetKey([])).toBe('');
  });

  it('agrees with the rules about which slots are free', () => {
    // Cross-check the O(1) conflict test against the authoritative rule, on
    // every in-bounds slot of a board that has walls on it.
    const existing: WallCoord[] = [h(4, 3), v(6, 6), h(1, 1), v(2, 7)];
    const index = buildWallIndex(existing);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        for (const probe of [h(row, col), v(row, col)]) {
          expect(slotConflicts(index, probe), slotName(probe)).toBe(
            doesWallConflict(probe, existing)
          );
        }
      }
    }
  });

  it('round-trips packed slot keys', () => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        for (const orientation of ['H', 'V'] as const) {
          const wall = { row, col, orientation };
          expect(unpackSlot(packSlot(wall))).toEqual(wall);
        }
      }
    }
  });
});

describe('regions: what a legal wall set can and cannot do', () => {
  it('sees one whole-board region before any wall exists', () => {
    const state = createInitialState({ mode: '2p' });
    const regions = computeRegions(boardOf(state).field.index);
    expect(regions.sizes).toHaveLength(1);
    expect(regions.sizes[0]).toBe(81);
    expect(regions.exitEdges[0]).toBe(0);
    expect(route(state).regionSize).toBe(81);
    expect(route(state).openings).toBe(3);
  });

  it('cannot be split by a single lattice row, because the walls conflict', () => {
    // Eight H walls across the middle would seal the board, but adjacent H slots
    // overlap and the rules forbid it, so only every other one is placeable and
    // one column always survives. This is why region counts are a poor pressure
    // signal and route tightness is used instead.
    const state = createInitialState({ mode: '2p' });
    state.walls = [0, 2, 4, 6].map((col) => h(4, col));
    const regions = computeRegions(boardOf(state).field.index);
    expect(regions.sizes).toEqual([81]);
    expect(regions.exitEdges[0]).toBe(0);
  });

  it('cuts off a pocket once a loop is closed', () => {
    const state = createInitialState({ mode: '2p' });
    // A one-cell ring is impossible in this game — the only two slots that close
    // the fourth side each cross one of the other two — so two cells is the
    // smallest legal pocket.
    state.walls = [h(3, 4), h(4, 4), v(4, 3), v(4, 5)];
    beginEpoch();
    const regions = boardOf(state).region;
    expect(regions.sizes).toHaveLength(2);
    const pocket = regions.label[4 * 9 + 4];
    expect(regions.sizes[pocket]).toBe(2);
    // Sealed means no OPEN boundary edges, for the pocket and for everything
    // around it: a wall is a wall from both sides.
    expect(regions.exitEdges[pocket]).toBe(0);
    expect(regions.sizes[1 - pocket]).toBe(79);
    expect(regions.exitEdges[1 - pocket]).toBe(0);
  });

  it('can never take a goal corner off the board', () => {
    // A goal corner is entered from its one horizontal neighbour or its one
    // vertical neighbour, and the two slots that close those edges cross each
    // other. So `goalCells` is a constant on an edge-goal board — which is why
    // the evaluation prices approach width instead of exit count.
    const state = createInitialState({ mode: 'race2' });
    state.walls = [h(0, 0), h(0, 2), h(0, 4), h(0, 6), h(1, 1), h(1, 3), h(1, 5), h(1, 7)];
    const profile = route(state);
    expect(profile.goalCells).toBe(9);
  });
});

describe('routes: distance, diversity, first steps, viable exits', () => {
  it('reads a straight 2p opening: 8 steps, one route, a whole open edge', () => {
    const profile = route(createInitialState({ mode: '2p' }));
    expect(profile.hasGoalAccess).toBe(true);
    expect(profile.distance).toBe(8);
    expect(profile.pathCount).toBe(1);
    // Nine winning squares are still live even though only one is nearest: this
    // is the "viable exits" fact that distance alone cannot express.
    expect(profile.goalCells).toBe(9);
    expect(profile.nearestGoals).toBe(1);
    expect(profile.firstSteps).toEqual([{ row: 7, col: 4 }]);
  });

  it('counts every square a player can still finish on in a race', () => {
    const open = createInitialState({ mode: 'race2' });
    expect(route(open).goalCells).toBe(9);
    expect(route(open).nearestGoals).toBe(1);
  });

  it('reports exactly one winning square in Center Rush', () => {
    const state = createInitialState({ mode: 'center2' });
    state.players[0].position = { row: 3, col: 3 };
    const profile = route(state);
    // One square to win on, but two equally short ways in — which is the whole
    // difference between Center Rush and a race.
    expect(profile.goalCells).toBe(1);
    expect(profile.nearestGoals).toBe(1);
    expect(profile.firstSteps).toHaveLength(2);
  });

  it('forces a detour and lengthens the route when the direct line is closed', () => {
    const straight = createInitialState({ mode: '2p' });
    straight.players[0].position = { row: 4, col: 4 };
    const direct = route(straight);
    expect(direct.distance).toBe(4);
    expect(direct.firstSteps).toEqual([{ row: 3, col: 4 }]);
    expect(direct.pathCount).toBe(1);

    // h(3,3) closes both (3,4) and (3,3) from below, so the straight run is gone
    // and the only optimal way is around the right.
    const blocked = createInitialState({ mode: '2p' });
    blocked.players[0].position = { row: 4, col: 4 };
    blocked.walls = [h(3, 3)];
    const detour = route(blocked);
    expect(detour.distance).toBe(5);
    expect(detour.firstSteps).toEqual([{ row: 4, col: 5 }]);
    expect(detour.nearCells[1]).toEqual({ row: 4, col: 5 });
  });

  it('reports how tight the route ahead is', () => {
    const open = createInitialState({ mode: '2p' });
    open.players[0].position = { row: 4, col: 4 };
    expect(route(open).openings).toBe(4);
    expect(route(open).tightest).toBe(4);

    // Fence the player into a dead end: up, left and right all closed, so the
    // only way out is back the way they came — and the route ahead is one wide.
    const boxed = createInitialState({ mode: '2p' });
    boxed.players[0].position = { row: 4, col: 4 };
    boxed.walls = [v(4, 3), v(4, 4), h(3, 3), h(3, 4)];
    const squeezed = route(boxed);
    expect(squeezed.openings).toBe(1);
    expect(squeezed.tightest).toBe(1);
    expect(squeezed.hasGoalAccess).toBe(true);
  });

  it('gives every seat of every mode goal access on a fresh board', () => {
    for (const mode of ['2p', '4p', 'race2', 'race3', 'race4', 'center2', 'center3'] as const) {
      const state = createInitialState({ mode });
      beginEpoch();
      const view = boardOf(state);
      for (const player of state.players) {
        const profile = routeOf(state, view, player);
        expect(profile.hasGoalAccess, `${mode}/${player.id}`).toBe(true);
        expect(profile.regionSize, `${mode}/${player.id}`).toBe(81);
        expect(profile.distance).toBeGreaterThan(0);
        expect(profile.firstSteps.length).toBeGreaterThan(0);
      }
    }
  });
});
