import { describe, expect, it } from 'vitest';
import { getShortestDistance } from '../src/pathfinding.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { WallCoord } from '../src/types.js';
import { isLegalWallPlacement, validateWallPlacement } from '../src/walls.js';

describe('Wall Rules & BFS Path Preservation', () => {
  it('allows legal wall placements in open space', () => {
    const state = createInitialState({ mode: '2p' });
    const wall: WallCoord = { row: 4, col: 4, orientation: 'H' };
    expect(isLegalWallPlacement(state, 'p1', wall)).toBe(true);
  });

  it('rejects wall placement when player has 0 walls remaining', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].wallsRemaining = 0;
    const wall: WallCoord = { row: 4, col: 4, orientation: 'H' };
    const err = validateWallPlacement(state, 'p1', wall);
    expect(err).not.toBeNull();
    expect(err?.code).toBe('NO_WALLS_REMAINING');
  });

  it('rejects wall placement out of bounds', () => {
    const state = createInitialState({ mode: '2p' });
    const wall: WallCoord = { row: 8, col: 0, orientation: 'H' };
    const err = validateWallPlacement(state, 'p1', wall);
    expect(err?.code).toBe('INVALID_WALL_COORDINATES');
  });

  it('rejects placing a wall directly crossing an existing wall', () => {
    const state = createInitialState({ mode: '2p' });
    state.walls = [{ row: 3, col: 3, orientation: 'H', placedByPlayerId: 'p1', sequence: 1 }];

    const crossWall: WallCoord = { row: 3, col: 3, orientation: 'V' };
    const err = validateWallPlacement(state, 'p1', crossWall);
    expect(err?.code).toBe('WALL_ALREADY_OCCUPIED');
  });

  it('rejects placing an overlapping wall on the same line', () => {
    const state = createInitialState({ mode: '2p' });
    state.walls = [{ row: 3, col: 3, orientation: 'H', placedByPlayerId: 'p1', sequence: 1 }];

    const overlapWall: WallCoord = { row: 3, col: 4, orientation: 'H' };
    const err = validateWallPlacement(state, 'p1', overlapWall);
    expect(err?.code).toBe('WALL_ALREADY_OCCUPIED');
  });

  it('rejects a wall that completely blocks a player path to goal (BFS check)', () => {
    const state = createInitialState({ mode: '2p' });
    // Move P2 to corner (0,0)
    state.players[1].position = { row: 0, col: 0 };

    // Trap P2 in (0,0):
    // Put a wall below (0,0): H wall at (0,0) blocks (0,0)<->(1,0) and (0,1)<->(1,1)
    // Put a wall to right of (0,0): V wall at (0,0) blocks (0,0)<->(0,1) and (1,0)<->(1,1)
    // If V wall is already at (0,0): P2 can only escape down to (1,0).
    // Now trying to place H wall at (0,0) would completely encase (0,0)!
    // Wait, (0,0) V and (0,0) H cross!
    // Instead, trap using:
    // H wall at (0,0) [blocks below (0,0) and (0,1)]
    // V wall at (0,1) [blocks right of (0,1) and (1,1)]
    // Let's place a corridor enclosure:
    // P2 at (0, 0).
    // Walls to trap (0,0):
    // 1. Horizontal wall at (0, 0): blocks (0,0) <-> (1,0) and (0,1) <-> (1,1).
    // 2. Vertical wall at (0, 1): does not cross (0,0). Blocks (0,1) <-> (0,2).
    // Let's also block (0,0) <-> (0,1): V wall at (0, -1) doesn't exist, but V wall at (0,0) would cross H(0,0).
    // How to cleanly enclose a corner?
    // Cell (0,0):
    // Can move to (0,1) or (1,0).
    // To block (1,0): H wall at (0,0) blocks (0,0)-(1,0) and (0,1)-(1,1).
    // To block (0,1): V wall at (0,0) blocks (0,0)-(0,1), but H(0,0) and V(0,0) cross.
    // Instead:
    // Put H wall at (0, 1) [blocks (0,1)-(1,1) and (0,2)-(1,2)].
    // Put V wall at (0, 0) [blocks (0,0)-(0,1) and (1,0)-(1,1)].
    // Now cell (0,0) can only go down to (1,0).
    // Cell (1,0) can go to (2,0) or (1,1) (wait, (1,0)-(1,1) is blocked by V(0,0)!).
    // So from (1,0), only down to (2,0) is open.
    // If we place H wall at (1, 0), it blocks (1,0)-(2,0)!
    // Then P2 in (0,0) has NO escape path!

    state.walls = [
      { row: 0, col: 0, orientation: 'V', placedByPlayerId: 'p1', sequence: 1 },
      // V(0,0) blocks (0,0)<->(0,1) and (1,0)<->(1,1).
      // Now from (0,0), P2 MUST go down to (1,0). From (1,0), cannot go right to (1,1), can only go down to (2,0).
    ];

    // Attempt to place H wall at (1, 0):
    // This blocks (1,0)<->(2,0) and (1,1)<->(2,1).
    // P2 is completely trapped!
    const trappingWall: WallCoord = { row: 1, col: 0, orientation: 'H' };

    const err = validateWallPlacement(state, 'p1', trappingWall);
    expect(err).not.toBeNull();
    expect(err?.code).toBe('WALL_BLOCKS_ALL_PATHS');
  });

  it('allows walls that elongate paths without sealing all exits', () => {
    const state = createInitialState({ mode: '2p' });
    const p1DistBefore = getShortestDistance(state.players[0].position, state.players[0].goalDirection, state.walls);

    // Place H wall directly in front of P1: (7, 4) H
    const wall: WallCoord = { row: 7, col: 4, orientation: 'H' };
    const res = applyAction(state, { type: 'PLACE_WALL', wall });
    expect(res.success).toBe(true);

    if (res.success) {
      const p1DistAfter = getShortestDistance(res.state.players[0].position, res.state.players[0].goalDirection, res.state.walls);
      expect(p1DistAfter).toBeGreaterThan(p1DistBefore);
      expect(p1DistAfter).toBeLessThan(Infinity); // Path is still open around the wall!
    }
  });
});
