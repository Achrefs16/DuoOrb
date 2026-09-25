import type { GameMode } from './types.js';

export const BOARD_SIZE = 9;
export const WALL_GRID_SIZE = 8; // 8x8 intersections

export const DEFAULT_2P_WALLS = 10;
export const DEFAULT_4P_WALLS = 5;

export const RULESET_CLASSIC_2P = 'classic-2p-v1';
export const RULESET_CLASSIC_4P = 'classic-4p-v1';
export const RULESET_CENTER_V1 = 'center-v1';
export const RULESET_RACE_V1 = 'race-v1';

/** Player count for every mode (2, 3 or 4 — never more). */
export function playerCountForMode(mode: GameMode): number {
  switch (mode) {
    case '2p':
    case 'race2':
    case 'center2':
      return 2;
    case 'race3':
    case 'center3':
      return 3;
    default:
      return 4;
  }
}

/** Starting walls per seat. Head-to-head meticulous (10), tables slimmer. */
export function startingWallsForMode(mode: GameMode): number {
  switch (mode) {
    case '2p':
    case 'race2':
    case 'center2':
      return DEFAULT_2P_WALLS;
    case 'race3':
    case 'center3':
      return 6;
    default:
      return DEFAULT_4P_WALLS;
  }
}

export const DIRECTIONS = [
  { dr: -1, dc: 0 }, // UP
  { dr: 1, dc: 0 },  // DOWN
  { dr: 0, dc: -1 }, // LEFT
  { dr: 0, dc: 1 },  // RIGHT
] as const;
