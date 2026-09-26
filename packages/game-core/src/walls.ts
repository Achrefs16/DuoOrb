import { WALL_GRID_SIZE } from './constants.js';
import { buildWallIndex, doesWallConflict, isWallWithinBoard } from './geometry.js';
import { hasPathToGoalWithIndex } from './pathfinding.js';
import { GameError, GameState, WallCoord } from './types.js';

/**
 * Validates whether placing a wall is legal.
 * Returns null if valid, or a GameError if invalid.
 */
export function validateWallPlacement(
  state: GameState,
  playerId: string,
  wall: WallCoord
): GameError | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { code: 'NOT_YOUR_TURN', message: 'Player not found in game.' };
  }

  // 1. Check player walls remaining
  if (player.wallsRemaining <= 0) {
    return { code: 'NO_WALLS_REMAINING', message: 'Player has no walls remaining.' };
  }

  // 2. Check bounds and orientation
  if (!isWallWithinBoard(wall)) {
    return { code: 'INVALID_WALL_COORDINATES', message: 'Wall coordinates are out of bounds.' };
  }

  // 3. Check collision/overlap/crossing with existing walls
  if (doesWallConflict(wall, state.walls)) {
    return {
      code: 'WALL_ALREADY_OCCUPIED',
      message: 'Wall conflicts with an existing wall placement (overlaps or crosses).',
    };
  }

  // 4. Temporarily place the wall and test BFS path preservation for every
  // still-active player. Finished players are ghosts: they keep their
  // earned place no matter how the board evolves, so they never veto walls.
  //
  // The wall index is built ONCE and shared by every player's search. The
  // board calls this on every wall-slot crossing while a wall is being dragged,
  // and rebuilding the index per player (and scanning the wall array per
  // neighbour) is what made dragging sluggish on a phone.
  const hypotheticalIndex = buildWallIndex([...state.walls, wall]);

  for (const p of state.players) {
    if (p.status !== 'ACTIVE') continue;
    const hasPath = hasPathToGoalWithIndex(
      p.position,
      p.goalDirection,
      hypotheticalIndex,
      state.mode
    );
    if (!hasPath) {
      return {
        code: 'WALL_BLOCKS_ALL_PATHS',
        message: `Wall completely blocks the path to goal for player ${p.displayName}.`,
      };
    }
  }

  return null;
}

/**
 * Checks if a wall placement is legal.
 */
export function isLegalWallPlacement(
  state: GameState,
  playerId: string,
  wall: WallCoord
): boolean {
  return validateWallPlacement(state, playerId, wall) === null;
}

/**
 * Generates all legal wall placements for a player in the current state.
 */
export function getLegalWalls(state: GameState, playerId: string): WallCoord[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.wallsRemaining <= 0) {
    return [];
  }

  const legalWalls: WallCoord[] = [];
  const orientations: ('H' | 'V')[] = ['H', 'V'];

  for (let r = 0; r < WALL_GRID_SIZE; r++) {
    for (let c = 0; c < WALL_GRID_SIZE; c++) {
      for (const orientation of orientations) {
        const candidate: WallCoord = { row: r, col: c, orientation };
        // Fast conflict filter before running BFS
        if (!doesWallConflict(candidate, state.walls)) {
          if (isLegalWallPlacement(state, playerId, candidate)) {
            legalWalls.push(candidate);
          }
        }
      }
    }
  }

  return legalWalls;
}
