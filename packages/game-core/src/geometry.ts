import { BOARD_SIZE, WALL_GRID_SIZE } from './constants.js';
import { CellCoord, Wall, WallCoord } from './types.js';

/**
 * Checks whether cell coordinates are within the 9x9 board.
 */
export function isCellWithinBoard(coord: CellCoord): boolean {
  return coord.row >= 0 && coord.row < BOARD_SIZE && coord.col >= 0 && coord.col < BOARD_SIZE;
}

/**
 * Checks whether wall intersection coordinates are within the 8x8 grid.
 */
export function isWallWithinBoard(wall: WallCoord): boolean {
  return (
    wall.row >= 0 &&
    wall.row < WALL_GRID_SIZE &&
    wall.col >= 0 &&
    wall.col < WALL_GRID_SIZE &&
    (wall.orientation === 'H' || wall.orientation === 'V')
  );
}

/**
 * Checks whether two cells are directly orthogonally adjacent (Manhattan distance == 1).
 */
export function areCellsAdjacent(c1: CellCoord, c2: CellCoord): boolean {
  const dRow = Math.abs(c1.row - c2.row);
  const dCol = Math.abs(c1.col - c2.col);
  return (dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1);
}

/**
 * Checks whether two cell coordinates represent the exact same cell.
 */
export function areCellsEqual(c1: CellCoord, c2: CellCoord): boolean {
  return c1.row === c2.row && c1.col === c2.col;
}

/**
 * Wall slot count: 8x8 intersections x 2 orientations.
 */
export const WALL_SLOT_COUNT = WALL_GRID_SIZE * WALL_GRID_SIZE * 2;

/** Flat index for a wall slot: (row * 8 + col) * 2 + (V ? 1 : 0). */
export function wallSlotIndex(wall: WallCoord): number {
  return (wall.row * WALL_GRID_SIZE + wall.col) * 2 + (wall.orientation === 'V' ? 1 : 0);
}

/**
 * Compiles a wall list into a 128-slot occupancy lookup.
 *
 * The naive `isBlockedByWall` scans the wall array with a closure for every
 * neighbour of every visited cell. A BFS visits 81 cells x 4 directions, so
 * that is 324 O(W) scans — around 6500 predicate calls with 20 walls on the
 * board. `validateWallPlacement` runs one such BFS per active player, and the
 * board re-runs it on every wall-slot crossing during a drag, which is what
 * made dragging a held wall across the board drop to ~15fps while dragging
 * outside it stayed smooth (no slot, no legality check).
 *
 * Building the index is O(W) once; every subsequent check is two array
 * lookups. No behaviour changes.
 */
export function buildWallIndex(walls: WallCoord[]): Uint8Array {
  const index = new Uint8Array(WALL_SLOT_COUNT);
  for (const w of walls) {
    if (
      w.row >= 0 &&
      w.row < WALL_GRID_SIZE &&
      w.col >= 0 &&
      w.col < WALL_GRID_SIZE
    ) {
      index[wallSlotIndex(w)] = 1;
    }
  }
  return index;
}

function hasWall(index: Uint8Array, row: number, col: number, orientation: 'H' | 'V'): boolean {
  if (row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE) return false;
  return index[(row * WALL_GRID_SIZE + col) * 2 + (orientation === 'V' ? 1 : 0)] === 1;
}

/** O(1) equivalent of isBlockedByWall against a prebuilt index. */
export function isBlockedByWallIndexed(
  from: CellCoord,
  to: CellCoord,
  index: Uint8Array
): boolean {
  if (to.row === from.row + 1 && to.col === from.col) {
    return hasWall(index, from.row, from.col, 'H') || hasWall(index, from.row, from.col - 1, 'H');
  }
  if (to.row === from.row - 1 && to.col === from.col) {
    return hasWall(index, to.row, from.col, 'H') || hasWall(index, to.row, from.col - 1, 'H');
  }
  if (to.col === from.col + 1 && to.row === from.row) {
    return hasWall(index, from.row, from.col, 'V') || hasWall(index, from.row - 1, from.col, 'V');
  }
  if (to.col === from.col - 1 && to.row === from.row) {
    return hasWall(index, from.row, to.col, 'V') || hasWall(index, from.row - 1, to.col, 'V');
  }
  return false;
}

/**
 * Checks whether a single-step move between adjacent cells is blocked by any wall in the walls list.
 */
export function isBlockedByWall(from: CellCoord, to: CellCoord, walls: WallCoord[]): boolean {
  return isBlockedByWallIndexed(from, to, buildWallIndex(walls));
}

/**
 * Checks if a proposed wall conflicts (crosses or overlaps) with any existing wall.
 */
export function doesWallConflict(proposed: WallCoord, existingWalls: WallCoord[]): boolean {
  for (const existing of existingWalls) {
    // 1. Cross collision: an H wall and V wall cannot intersect at the same (row, col)
    if (
      proposed.row === existing.row &&
      proposed.col === existing.col &&
      proposed.orientation !== existing.orientation
    ) {
      return true;
    }

    // 2. Exact same wall slot & orientation
    if (
      proposed.row === existing.row &&
      proposed.col === existing.col &&
      proposed.orientation === existing.orientation
    ) {
      return true;
    }

    // 3. Overlap in Horizontal orientation:
    // Proposed H wall at (r, c) spans cols [c, c+1]. Existing H wall at (r, c-1) spans [c-1, c],
    // or at (r, c+1) spans [c+1, c+2]. These overlap by 1 cell length!
    if (proposed.orientation === 'H' && existing.orientation === 'H') {
      if (proposed.row === existing.row && Math.abs(proposed.col - existing.col) === 1) {
        return true;
      }
    }

    // 4. Overlap in Vertical orientation:
    // Proposed V wall at (r, c) spans rows [r, r+1]. Existing V wall at (r-1, c) spans [r-1, r],
    // or at (r+1, c) spans [r+1, r+2]. These overlap by 1 cell length!
    if (proposed.orientation === 'V' && existing.orientation === 'V') {
      if (proposed.col === existing.col && Math.abs(proposed.row - existing.row) === 1) {
        return true;
      }
    }
  }

  return false;
}
