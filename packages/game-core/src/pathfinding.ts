import { BOARD_SIZE, DIRECTIONS } from './constants.js';
import {
  areCellsAdjacent,
  buildWallIndex,
  isBlockedByWallIndexed,
  isCellWithinBoard,
} from './geometry.js';
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
 *
 * Takes a prebuilt wall index (see buildWallIndex) so the neighbour scan is
 * O(1) per direction rather than O(walls).
 */
export function getCellNeighbors(
  cell: CellCoord,
  walls: WallCoord[] | Uint8Array
): CellCoord[] {
  const index = walls instanceof Uint8Array ? walls : buildWallIndex(walls);
  const neighbors: CellCoord[] = [];

  for (const dir of DIRECTIONS) {
    const next: CellCoord = {
      row: cell.row + dir.dr,
      col: cell.col + dir.dc,
    };

    if (isCellWithinBoard(next) && !isBlockedByWallIndexed(cell, next, index)) {
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

const CELLS = BOARD_SIZE * BOARD_SIZE;
const UNREACHED = -1;

/** Upper bound on counted shortest paths, so a wide-open board cannot overflow. */
const PATH_COUNT_CAP = 4096;

interface PathTable {
  /** Steps from `start`, or UNREACHED. */
  dist: Int16Array;
  /** Number of distinct shortest paths from `start`, capped at PATH_COUNT_CAP. */
  count: Int32Array;
  /** Predecessor cell index along the discovered shortest path. */
  parent: Int32Array;
  /** Any goal cell index reached, or UNREACHED. */
  goalIndex: number;
}

const tablePool: PathTable[] = [];

/**
 * Single BFS from `start` producing distance, shortest-path multiplicity and
 * parents in one sweep.
 *
 * Runs to completion rather than stopping at the first goal cell: the fork
 * count is only correct once every cell at the goal's distance layer has been
 * expanded, and the board is 81 cells so the extra work is negligible. Using a
 * read cursor instead of `Array.shift` also removes the O(n^2) pop that the
 * old queue incurred on every call — this runs once per player per leaf.
 *
 * Neighbour order is unchanged (DIRECTIONS order), so the reconstructed path
 * is identical to the previous early-exit implementation.
 */
function buildPathTable(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): PathTable {
  const table = tablePool.pop() ?? {
    dist: new Int16Array(CELLS),
    count: new Int32Array(CELLS),
    parent: new Int32Array(CELLS),
    goalIndex: UNREACHED,
  };
  table.dist.fill(UNREACHED);
  table.count.fill(0);
  table.parent.fill(UNREACHED);
  table.goalIndex = UNREACHED;

  const wallIndex = buildWallIndex(walls);
  const startIndex = cellToIndex(start);
  table.dist[startIndex] = 0;
  table.count[startIndex] = 1;

  const queue = new Int32Array(CELLS);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;

  while (head < tail) {
    const currentIndex = queue[head++];
    const current = indexToCell(currentIndex);
    const nextDist = table.dist[currentIndex] + 1;
    const currentCount = table.count[currentIndex];

    for (const neighbor of getCellNeighbors(current, wallIndex)) {
      const neighborIndex = cellToIndex(neighbor);
      const seen = table.dist[neighborIndex];
      if (seen === UNREACHED) {
        table.dist[neighborIndex] = nextDist;
        table.count[neighborIndex] = currentCount;
        table.parent[neighborIndex] = currentIndex;
        if (table.goalIndex === UNREACHED && isGoalCell(neighbor, goalDirection, mode)) {
          table.goalIndex = neighborIndex;
        }
        queue[tail++] = neighborIndex;
      } else if (seen === nextDist) {
        // Another equally short route into this cell — a fork.
        if (table.count[neighborIndex] < PATH_COUNT_CAP) {
          table.count[neighborIndex] = Math.min(
            PATH_COUNT_CAP,
            table.count[neighborIndex] + currentCount
          );
        }
      }
    }
  }

  return table;
}

function releasePathTable(table: PathTable): void {
  if (tablePool.length < 8) tablePool.push(table);
}

/**
 * Reusable scratch for the distance-only BFS. The AI is single-threaded and
 * this never escapes the call, so a single shared buffer avoids allocating two
 * typed arrays on every leaf of the search.
 */
const distanceScratch = new Int16Array(CELLS);
const distanceQueue = new Int32Array(CELLS);

/**
 * Everything the AI needs to know about one player's route in a single BFS:
 * how far they are, how many distinct shortest ways there are to get there
 * (a fork is expensive to wall down), and the first square of the optimal
 * route. Returns null when no path exists.
 */
export interface PathInfo {
  distance: number;
  /** Distinct shortest paths, capped at PATH_COUNT_CAP. */
  pathCount: number;
  /** First step of one optimal route, or null when already at the goal. */
  firstStep: CellCoord | null;
}

export function getPathInfo(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): PathInfo | null {
  if (isGoalCell(start, goalDirection, mode)) {
    return { distance: 0, pathCount: 1, firstStep: null };
  }

  const table = buildPathTable(start, goalDirection, walls, mode);
  const goalIndex = table.goalIndex;
  if (goalIndex === UNREACHED) {
    releasePathTable(table);
    return null;
  }

  const parentIndex = table.parent[goalIndex];
  const info: PathInfo = {
    distance: table.dist[goalIndex],
    pathCount: table.count[goalIndex],
    firstStep: parentIndex === UNREACHED ? null : indexToCell(parentIndex),
  };
  releasePathTable(table);
  return info;
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

  const table = buildPathTable(start, goalDirection, walls, mode);
  if (table.goalIndex === UNREACHED) {
    releasePathTable(table);
    return null;
  }

  // Reconstruct path
  const path: CellCoord[] = [];
  let curr: number | undefined = table.goalIndex;
  while (curr !== undefined) {
    path.push(indexToCell(curr));
    curr = table.parent[curr] === UNREACHED ? undefined : table.parent[curr];
  }

  releasePathTable(table);
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
 * Same check against a prebuilt wall index, so a caller testing several
 * players against one hypothetical board pays for the index once.
 */
export function hasPathToGoalWithIndex(
  start: CellCoord,
  goalDirection: GoalDirection,
  wallIndex: Uint8Array,
  mode?: GameMode
): boolean {
  if (isGoalCell(start, goalDirection, mode)) return true;
  return getShortestDistanceIndexed(start, goalDirection, wallIndex, mode) !== Infinity;
}

/** Distance-only BFS against a prebuilt index. */
function getShortestDistanceIndexed(
  start: CellCoord,
  goalDirection: GoalDirection,
  wallIndex: Uint8Array,
  mode?: GameMode
): number {
  const dist = distanceScratch;
  dist.fill(UNREACHED);

  const startIndex = cellToIndex(start);
  dist[startIndex] = 0;

  const queue = distanceQueue;
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;

  while (head < tail) {
    const currentIndex = queue[head++];
    const nextDist = dist[currentIndex] + 1;
    for (const neighbor of getCellNeighbors(indexToCell(currentIndex), wallIndex)) {
      const neighborIndex = cellToIndex(neighbor);
      if (dist[neighborIndex] !== UNREACHED) continue;
      dist[neighborIndex] = nextDist;
      if (isGoalCell(neighbor, goalDirection, mode)) return nextDist;
      queue[tail++] = neighborIndex;
    }
  }

  return Infinity;
}

/**
 * Gets the shortest distance (number of moves) from start to goal. Returns Infinity if no path.
 *
 * Deliberately leaner than getPathInfo: this is the hottest call in the AI
 * (once per player per search leaf) and only needs the distance, so it runs a
 * dedicated BFS that exits as soon as the goal layer is reached and skips the
 * fork-count bookkeeping entirely.
 */
export function getShortestDistance(
  start: CellCoord,
  goalDirection: GoalDirection,
  walls: WallCoord[],
  mode?: GameMode
): number {
  if (isGoalCell(start, goalDirection, mode)) {
    return 0;
  }

  const wallIndex = buildWallIndex(walls);
  const dist = distanceScratch;
  dist.fill(UNREACHED);

  const startIndex = cellToIndex(start);
  dist[startIndex] = 0;

  const queue = distanceQueue;
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;

  while (head < tail) {
    const currentIndex = queue[head++];
    const nextDist = dist[currentIndex] + 1;

    for (const neighbor of getCellNeighbors(indexToCell(currentIndex), wallIndex)) {
      const neighborIndex = cellToIndex(neighbor);
      if (dist[neighborIndex] !== UNREACHED) continue;
      dist[neighborIndex] = nextDist;
      if (isGoalCell(neighbor, goalDirection, mode)) {
        return nextDist;
      }
      queue[tail++] = neighborIndex;
    }
  }

  return Infinity;
}
