import { BOARD_SIZE, DIRECTIONS } from './constants.js';
import { areCellsAdjacent, isBlockedByWall, isCellWithinBoard } from './geometry.js';
import { CellCoord, GameMode, GoalDirection, PlayerState, WallCoord } from './types.js';

/** Modes whose winning square is the single board center (legacy '4p' included). */
export function isCenterGoalMode(mode?: GameMode): boolean {
  return mode === '4p' || mode === 'center2' || mode === 'center3';
}

/** Middle index of an edge (4 on a 9x9 board). */
export const GOAL_MIDDLE_INDEX = Math.floor(BOARD_SIZE / 2);

/**
 * Middle square of a goal edge.
 */
export function goalTargetCell(goalDirection: GoalDirection): CellCoord {
  switch (goalDirection) {
    case 'TOP':
      return { row: 0, col: GOAL_MIDDLE_INDEX };
    case 'BOTTOM':
      return { row: BOARD_SIZE - 1, col: GOAL_MIDDLE_INDEX };
    case 'LEFT':
      return { row: GOAL_MIDDLE_INDEX, col: 0 };
    case 'RIGHT':
      return { row: GOAL_MIDDLE_INDEX, col: BOARD_SIZE - 1 };
  }
}

/** The single center square — the winning square for ALL players in 4-player mode. */
export const BOARD_CENTER: CellCoord = { row: GOAL_MIDDLE_INDEX, col: GOAL_MIDDLE_INDEX };

export function isGoalCell(
  coord: CellCoord,
  goalDirection: GoalDirection,
  mode?: GameMode
): boolean {
  // Center-goal modes: everyone races for the single center square.
  if (isCenterGoalMode(mode)) {
    return coord.row === BOARD_CENTER.row && coord.col === BOARD_CENTER.col;
  }
  switch (goalDirection) {
    case 'TOP':
      return coord.row === 0;
    case 'BOTTOM':
      return coord.row === BOARD_SIZE - 1;
    case 'LEFT':
      return coord.col === 0;
    case 'RIGHT':
      return coord.col === BOARD_SIZE - 1;
  }
}

/**
 * Returns valid orthogonal neighbors for a cell given existing walls.
 */
export function getCellNeighbors(cell: CellCoord, walls: WallCoord[]): CellCoord[] {
  const neighbors: CellCoord[] = [];

  for (const dir of DIRECTIONS) {
    const next: CellCoord = {
      row: cell.row + dir.dr,
      col: cell.col + dir.dc,
    };

    if (isCellWithinBoard(next) && !isBlockedByWall(cell, next, walls)) {
      neighbors.push(next);
    }
  }

  return neighbors;
}

/**
 * Encodes a CellCoord to an integer index 0..80.
 */
export function cellToIndex(cell: CellCoord): number {
  return cell.row * BOARD_SIZE + cell.col;
}

/**
 * Decodes an integer index 0..80 to CellCoord.
 */
export function indexToCell(index: number): CellCoord {
  return {
    row: Math.floor(index / BOARD_SIZE),
    col: index % BOARD_SIZE,
  };
}

/**
 * Computes shortest path from a start cell to the goal direction using BFS.
 * Returns array of CellCoord including start and target cell, or null if no path exists.
 */
export function getShortestPath(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): CellCoord[] | null {
  if (isGoalCell(start, goalDirection, mode)) {
    return [start];
  }

  const queue: number[] = [cellToIndex(start)];
  const parent = new Map<number, number>();
  const visited = new Uint8Array(BOARD_SIZE * BOARD_SIZE);
  visited[cellToIndex(start)] = 1;

  let goalIndex: number | null = null;

  while (queue.length > 0) {
    const currentIndex = queue.shift()!;
    const current = indexToCell(currentIndex);

    if (isGoalCell(current, goalDirection, mode)) {
      goalIndex = currentIndex;
      break;
    }

    const neighbors = getCellNeighbors(current, walls);
    for (const neighbor of neighbors) {
      const neighborIndex = cellToIndex(neighbor);
      if (!visited[neighborIndex]) {
        visited[neighborIndex] = 1;
        parent.set(neighborIndex, currentIndex);
        queue.push(neighborIndex);
      }
    }
  }

  if (goalIndex === null) {
    return null;
  }

  // Reconstruct path
  const path: CellCoord[] = [];
  let curr: number | undefined = goalIndex;
  while (curr !== undefined) {
    path.push(indexToCell(curr));
    curr = parent.get(curr);
  }

  return path.reverse();
}

/**
 * Checks if a path exists from start to goalDirection.
 */
export function hasPathToGoal(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): boolean {
  return getShortestPath(start, goalDirection, walls, mode) !== null;
}

/**
 * Gets the shortest distance (number of moves) from start to goal. Returns Infinity if no path.
 */
export function getShortestDistance(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): number {
  const path = getShortestPath(start, goalDirection, walls, mode);
  return path ? path.length - 1 : Infinity;
}
