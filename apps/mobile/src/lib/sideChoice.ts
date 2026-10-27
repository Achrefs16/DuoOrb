import {
  PLAYER_COLORS_DEFAULT,
  playerCountForMode,
  type GameMode,
} from '@duoorb/game-core';

/**
 * Seat the player asked to control. Seats follow game-core's player order;
 * `random` is resolved once at launch so a match never changes sides.
 */
export type SideChoice = 'blue' | 'red' | 'green' | 'amber' | 'random';
export type SeatSide = Exclude<SideChoice, 'random'>;

export const SEAT_SIDES = [
  'blue',
  'red',
  'green',
  'amber',
] as const satisfies readonly SeatSide[];

/** Swatches match the balls game-core creates for each seat. */
export const SEAT_COLORS: Record<SeatSide, string> = {
  blue: PLAYER_COLORS_DEFAULT[0],
  red: PLAYER_COLORS_DEFAULT[1],
  green: PLAYER_COLORS_DEFAULT[2],
  amber: PLAYER_COLORS_DEFAULT[3],
};

const SIDE_CHOICES: readonly SideChoice[] = [...SEAT_SIDES, 'random'];

export function isSideChoice(value: unknown): value is SideChoice {
  return typeof value === 'string' && (SIDE_CHOICES as readonly string[]).includes(value);
}

/** Seats that actually exist in a 2P, 3P or 4P match, in seat order. */
export function sidesForCount(count: number): readonly SeatSide[] {
  if (count >= 4) return SEAT_SIDES;
  if (count === 3) return SEAT_SIDES.slice(0, 3);
  return SEAT_SIDES.slice(0, 2);
}

/** True when the choice can be used in a match with this many seats. */
export function isSideAvailable(choice: SideChoice, count: number): boolean {
  return choice === 'random' || sidesForCount(count).includes(choice as SeatSide);
}

/**
 * Resolve a picker choice to a concrete seat for the selected mode. A saved
 * colour outside the mode's seat count falls back to blue rather than
 * silently playing a different seat.
 */
export function resolveSideChoice(
  choice: SideChoice,
  mode: GameMode,
  random: () => number = Math.random
): SeatSide {
  const seats = sidesForCount(playerCountForMode(mode));
  if (choice !== 'random') {
    return seats.includes(choice as SeatSide) ? (choice as SeatSide) : 'blue';
  }
  return seats[sideIndexForChoice('random', seats.length, random)] ?? 'blue';
}

/** 0-based seat index for a side in a match with `count` players. */
export function sideIndexForChoice(
  choice: SideChoice,
  count: number,
  random: () => number = Math.random
): number {
  const seats = sidesForCount(count);
  if (choice !== 'random') {
    const index = seats.indexOf(choice as SeatSide);
    return index >= 0 ? index : 0;
  }
  return Math.min(seats.length - 1, Math.floor(random() * seats.length));
}
