import { describe, expect, it } from 'vitest';
import { getLegalMoves, getLegalMovesFrom, isLegalMove } from '../src/movement.js';
import { createInitialState } from '../src/ruleset.js';
import { GameState, WallCoord } from '../src/types.js';

describe('Movement & Jump Engine', () => {
  it('computes initial legal moves for Player 1 in 2P', () => {
    const state = createInitialState({ mode: '2p' });
    // P1 is at (8, 4). Adjacent cells: UP (7,4), LEFT (8,3), RIGHT (8,5). DOWN (9,4) is out of bounds.
    const moves = getLegalMoves(state, 'p1');
    expect(moves).toHaveLength(3);
    expect(moves).toContainEqual({ row: 7, col: 4 });
    expect(moves).toContainEqual({ row: 8, col: 3 });
    expect(moves).toContainEqual({ row: 8, col: 5 });
  });

  it('rejects moving through a placed wall', () => {
    const state = createInitialState({ mode: '2p' });
    // Place wall between (8,4) and (7,4): H wall at (7,4) or (7,3)
    const wall: WallCoord = { row: 7, col: 4, orientation: 'H' };
    state.walls = [{ ...wall, placedByPlayerId: 'p2', sequence: 1 }];

    const moves = getLegalMoves(state, 'p1');
    // UP (7,4) should now be blocked
    expect(moves).not.toContainEqual({ row: 7, col: 4 });
    expect(moves).toContainEqual({ row: 8, col: 3 });
    expect(moves).toContainEqual({ row: 8, col: 5 });
  });

  it('allows straight jump over adjacent opponent when unblocked', () => {
    const state = createInitialState({ mode: '2p' });
    // Put P1 at (4,4) and P2 at (3,4)
    state.players[0].position = { row: 4, col: 4 };
    state.players[1].position = { row: 3, col: 4 };

    const moves = getLegalMoves(state, 'p1');
    // Straight jump over P2 to (2, 4) must be legal
    expect(moves).toContainEqual({ row: 2, col: 4 });
    // Normal steps: DOWN (5,4), LEFT (4,3), RIGHT (4,5)
    expect(moves).toContainEqual({ row: 5, col: 4 });
    expect(moves).toContainEqual({ row: 4, col: 3 });
    expect(moves).toContainEqual({ row: 4, col: 5 });
    // Stepping directly onto P2 at (3,4) must NOT be legal
    expect(moves).not.toContainEqual({ row: 3, col: 4 });
    // Diagonals (3,3) and (3,5) must NOT be legal because straight jump is unblocked!
    expect(moves).not.toContainEqual({ row: 3, col: 3 });
    expect(moves).not.toContainEqual({ row: 3, col: 5 });
  });

  it('allows diagonal jumps when straight jump is blocked by a wall', () => {
    const state = createInitialState({ mode: '2p' });
    // P1 at (4,4), P2 at (3,4)
    state.players[0].position = { row: 4, col: 4 };
    state.players[1].position = { row: 3, col: 4 };

    // Place H wall behind P2: between row 2 and row 3 -> row 2, col 4 H wall
    const wall: WallCoord = { row: 2, col: 4, orientation: 'H' };
    state.walls = [{ ...wall, placedByPlayerId: 'p2', sequence: 1 }];

    const moves = getLegalMoves(state, 'p1');
    // Straight jump (2,4) is now blocked by wall
    expect(moves).not.toContainEqual({ row: 2, col: 4 });
    // Diagonal jump options to the sides of P2: (3,3) and (3,5)
    expect(moves).toContainEqual({ row: 3, col: 3 });
    expect(moves).toContainEqual({ row: 3, col: 5 });
  });

  it('allows diagonal jumps when straight jump is blocked by the board edge', () => {
    const state = createInitialState({ mode: '2p' });
    // P2 is at top edge (0,4), P1 is adjacent at (1,4)
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 0, col: 4 };

    const moves = getLegalMoves(state, 'p1');
    // Straight jump (-1, 4) is out of bounds
    // Side jumps (0,3) and (0,5) must be legal
    expect(moves).toContainEqual({ row: 0, col: 3 });
    expect(moves).toContainEqual({ row: 0, col: 5 });
  });

  it('allows diagonal jumps in 4P when straight jump is blocked by a third player', () => {
    const state = createInitialState({ mode: '4p' });
    // P1 at (4,4), P2 at (3,4), P3 at (2,4)
    state.players[0].position = { row: 4, col: 4 };
    state.players[1].position = { row: 3, col: 4 };
    state.players[2].position = { row: 2, col: 4 };

    const moves = getLegalMoves(state, 'p1');
    // Straight jump (2,4) is blocked by P3
    expect(moves).not.toContainEqual({ row: 2, col: 4 });
    // Diagonal jumps around P2: (3,3) and (3,5)
    expect(moves).toContainEqual({ row: 3, col: 3 });
    expect(moves).toContainEqual({ row: 3, col: 5 });
  });

  it('prevents diagonal jump if side cell is blocked by a vertical wall', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 4, col: 4 };
    state.players[1].position = { row: 3, col: 4 };

    // Wall behind P2 blocking straight jump
    const wallBehind: WallCoord = { row: 2, col: 4, orientation: 'H' };
    // Wall to the right of P2: vertical wall between col 4 and 5 at row 3
    const wallSide: WallCoord = { row: 3, col: 4, orientation: 'V' };
    state.walls = [
      { ...wallBehind, placedByPlayerId: 'p2', sequence: 1 },
      { ...wallSide, placedByPlayerId: 'p2', sequence: 2 },
    ];

    const moves = getLegalMoves(state, 'p1');
    // Straight (2,4) blocked
    expect(moves).not.toContainEqual({ row: 2, col: 4 });
    // Left diagonal (3,3) is free
    expect(moves).toContainEqual({ row: 3, col: 3 });
    // Right diagonal (3,5) is blocked by vertical wall
    expect(moves).not.toContainEqual({ row: 3, col: 5 });
  });

  it('computes destinations from an arbitrary square identically', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 4, col: 4 };
    // Same square: identical to the anchored version.
    expect(getLegalMovesFrom(state, 'p1', { row: 4, col: 4 })).toEqual(
      getLegalMoves(state, 'p1')
    );
    // Open square: four orthogonal neighbors.
    expect(getLegalMovesFrom(state, 'p1', { row: 5, col: 5 })).toEqual(
      expect.arrayContaining([
        { row: 4, col: 5 },
        { row: 6, col: 5 },
        { row: 5, col: 4 },
        { row: 5, col: 6 },
      ])
    );
    // Unknown player: empty.
    expect(getLegalMovesFrom(state, 'nobody', { row: 5, col: 5 })).toEqual([]);
  });
});
