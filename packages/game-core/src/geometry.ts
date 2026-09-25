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
 * Checks whether a single-step move between adjacent cells is blocked by any wall in the walls list.
 */
export function isBlockedByWall(from: CellCoord, to: CellCoord, walls: WallCoord[]): boolean {
  // Movement down: (r, c) -> (r+1, c)
  if (to.row === from.row + 1 && to.col === from.col) {
    return walls.some(
      (w) =>
        w.orientation === 'H' &&
        w.row === from.row &&
        (w.col === from.col || w.col === from.col - 1)
    );
  }

  // Movement up: (r, c) -> (r-1, c)
  if (to.row === from.row - 1 && to.col === from.col) {
    return walls.some(
      (w) =>
        w.orientation === 'H' &&
        w.row === to.row &&
        (w.col === from.col || w.col === from.col - 1)
    );
  }

  // Movement right: (r, c) -> (r, c+1)
  if (to.col === from.col + 1 && to.row === from.row) {
    return walls.some(
      (w) =>
        w.orientation === 'V' &&
        w.col === from.col &&
        (w.row === from.row || w.row === from.row - 1)
    );
  }

  // Movement left: (r, c) -> (r, c-1)
  if (to.col === from.col - 1 && to.row === from.row) {
    return walls.some(
      (w) =>
        w.orientation === 'V' &&
        w.col === to.col &&
        (w.row === from.row || w.row === from.row - 1)
    );
  }

  return false;
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
