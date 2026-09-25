import { describe, expect, it } from 'vitest';
import {
  areCellsAdjacent,
  doesWallConflict,
  isBlockedByWall,
  isCellWithinBoard,
  isWallWithinBoard,
} from '../src/geometry.js';
import { WallCoord } from '../src/types.js';

describe('Geometry & Bounds', () => {
  it('identifies cells inside and outside 9x9 board', () => {
    expect(isCellWithinBoard({ row: 0, col: 0 })).toBe(true);
    expect(isCellWithinBoard({ row: 8, col: 8 })).toBe(true);
    expect(isCellWithinBoard({ row: 4, col: 4 })).toBe(true);
    expect(isCellWithinBoard({ row: -1, col: 0 })).toBe(false);
    expect(isCellWithinBoard({ row: 9, col: 4 })).toBe(false);
    expect(isCellWithinBoard({ row: 4, col: 9 })).toBe(false);
  });

  it('identifies wall coordinates inside and outside 8x8 grid', () => {
    expect(isWallWithinBoard({ row: 0, col: 0, orientation: 'H' })).toBe(true);
    expect(isWallWithinBoard({ row: 7, col: 7, orientation: 'V' })).toBe(true);
    expect(isWallWithinBoard({ row: 8, col: 0, orientation: 'H' })).toBe(false);
    expect(isWallWithinBoard({ row: 0, col: 8, orientation: 'V' })).toBe(false);
  });

  it('checks cell adjacency', () => {
    expect(areCellsAdjacent({ row: 4, col: 4 }, { row: 3, col: 4 })).toBe(true);
    expect(areCellsAdjacent({ row: 4, col: 4 }, { row: 4, col: 5 })).toBe(true);
    expect(areCellsAdjacent({ row: 4, col: 4 }, { row: 3, col: 3 })).toBe(false); // Diagonal
    expect(areCellsAdjacent({ row: 4, col: 4 }, { row: 6, col: 4 })).toBe(false); // 2 steps
  });

  it('detects wall blocking orthogonal steps', () => {
    const horizontalWall: WallCoord = { row: 3, col: 4, orientation: 'H' };
    // Blocks (3,4) <-> (4,4) and (3,5) <-> (4,5)
    expect(isBlockedByWall({ row: 3, col: 4 }, { row: 4, col: 4 }, [horizontalWall])).toBe(true);
    expect(isBlockedByWall({ row: 4, col: 4 }, { row: 3, col: 4 }, [horizontalWall])).toBe(true);
    expect(isBlockedByWall({ row: 3, col: 5 }, { row: 4, col: 5 }, [horizontalWall])).toBe(true);
    expect(isBlockedByWall({ row: 4, col: 5 }, { row: 3, col: 5 }, [horizontalWall])).toBe(true);

    // Does not block adjacent column (3,6) <-> (4,6) or (3,3) <-> (4,3)
    expect(isBlockedByWall({ row: 3, col: 6 }, { row: 4, col: 6 }, [horizontalWall])).toBe(false);
    expect(isBlockedByWall({ row: 3, col: 3 }, { row: 4, col: 3 }, [horizontalWall])).toBe(false);

    const verticalWall: WallCoord = { row: 3, col: 4, orientation: 'V' };
    // Blocks (3,4) <-> (3,5) and (4,4) <-> (4,5)
    expect(isBlockedByWall({ row: 3, col: 4 }, { row: 3, col: 5 }, [verticalWall])).toBe(true);
    expect(isBlockedByWall({ row: 4, col: 4 }, { row: 4, col: 5 }, [verticalWall])).toBe(true);
    expect(isBlockedByWall({ row: 2, col: 4 }, { row: 2, col: 5 }, [verticalWall])).toBe(false);
  });

  it('detects wall conflicts: identical, cross, and overlap', () => {
    const existing: WallCoord[] = [{ row: 3, col: 4, orientation: 'H' }];

    // Identical
    expect(doesWallConflict({ row: 3, col: 4, orientation: 'H' }, existing)).toBe(true);

    // Cross: V wall at same (3,4)
    expect(doesWallConflict({ row: 3, col: 4, orientation: 'V' }, existing)).toBe(true);

    // Overlap: H wall at (3,3) or (3,5) shares an edge segment
    expect(doesWallConflict({ row: 3, col: 3, orientation: 'H' }, existing)).toBe(true);
    expect(doesWallConflict({ row: 3, col: 5, orientation: 'H' }, existing)).toBe(true);

    // Non-conflicting: H wall at (3,6) or (4,4)
    expect(doesWallConflict({ row: 3, col: 6, orientation: 'H' }, existing)).toBe(false);
    expect(doesWallConflict({ row: 4, col: 4, orientation: 'H' }, existing)).toBe(false);

    // V wall touching end without crossing: (2,4) or (4,4)
    expect(doesWallConflict({ row: 2, col: 4, orientation: 'V' }, existing)).toBe(false);
    expect(doesWallConflict({ row: 4, col: 4, orientation: 'V' }, existing)).toBe(false);
  });
});
