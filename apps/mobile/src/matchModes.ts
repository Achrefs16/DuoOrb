import { GameMode } from '@duoorb/game-core';

/** Display name for a match mode. Rules live in game-core; this is labels only. */
export function modeLabel(mode: GameMode): string {
  switch (mode) {
    case '2p':
      return 'Classic 1v1';
    case '4p':
      return 'Center Rush';
    case 'race2':
      return 'Race 2';
    case 'race3':
      return 'Race 3';
    case 'race4':
      return 'Race 4';
    case 'center2':
      return 'Center Rush 2P';
    case 'center3':
      return 'Center Rush 3P';
    default:
      return mode;
  }
}

export type MatchType = 'classic' | 'center' | 'race';

/** Resolve the player-facing Type × Players pick to a ruleset mode. Classic is always head-to-head 1v1. */
export function resolveMode(type: MatchType, count: 2 | 3 | 4): GameMode {
  if (type === 'race') return count === 3 ? 'race3' : count === 4 ? 'race4' : 'race2';
  if (type === 'center') return count === 2 ? 'center2' : count === 3 ? 'center3' : '4p';
  return '2p';
}
