/**
 * Match Assists Economy (Divided Hints & Undos system).
 *
 * Scope:
 * - Active strictly in vs AI (Offline/Bots) and Local Practice.
 * - 100% disabled in Online Ranked / Quick Match (competitive integrity).
 *
 * Rules:
 * - Free tier: starts with 1 Free Hint + 1 Free Undo per match (tracked separately).
 *   Can watch a rewarded video ad for +1 Hint (when out of hints) or +1 Undo (when out of undos),
 *   up to MAX_AD_REFILLS_PER_MATCH per category.
 * - Premium tier: starts with 9 Hints + 9 Undos per match.
 * - Star rating synergy:
 *   0 assists used = 3 Stars ⭐️⭐️⭐️
 *   1 assist used  = 2 Stars ⭐️⭐️
 *   2+ assists used = 1 Star ⭐️
 */

export type AssistKind = 'hint' | 'undo';

export const FREE_STARTING_ASSISTS = 1;
export const FREE_STARTING_HINTS = 1;
export const FREE_STARTING_UNDOS = 1;
export const PREMIUM_STARTING_ASSISTS = 9;
export const PREMIUM_STARTING_HINTS = 9;
export const PREMIUM_STARTING_UNDOS = 9;
export const REFILL_ASSISTS_GRANT = 1;
export const MAX_AD_REFILLS_PER_MATCH = 2;

export interface MatchAssistsState {
  /** Remaining hint tokens available in the current match */
  hintsRemaining: number;
  /** Remaining undo tokens available in the current match */
  undosRemaining: number;
  /** Back-compat alias for hintsRemaining */
  remaining: number;
  /** Total assists (hints + undos) consumed so far in the current match (drives bot mastery stars) */
  used: number;
  /** Number of hint ad refills redeemed in this match */
  hintRefillsUsed: number;
  /** Number of undo ad refills redeemed in this match */
  undoRefillsUsed: number;
  /** Back-compat alias for hintRefillsUsed */
  refillsUsed: number;
  /** Whether the user has DuoOrb Premium */
  isPremium: boolean;
}

/**
 * Initialize a fresh divided assists pool (1 Hint + 1 Undo for Free; 9 + 9 for Premium) at the start of a match.
 */
export function createMatchAssists(isPremium: boolean): MatchAssistsState {
  const startHints = isPremium ? PREMIUM_STARTING_HINTS : FREE_STARTING_HINTS;
  const startUndos = isPremium ? PREMIUM_STARTING_UNDOS : FREE_STARTING_UNDOS;
  return {
    hintsRemaining: startHints,
    undosRemaining: startUndos,
    remaining: startHints,
    used: 0,
    hintRefillsUsed: 0,
    undoRefillsUsed: 0,
    refillsUsed: 0,
    isPremium,
  };
}

/**
 * Check if the player has at least one token of the given kind available to spend immediately.
 */
export function canUseAssist(
  state: MatchAssistsState,
  kind: AssistKind = 'hint'
): boolean {
  return kind === 'undo' ? state.undosRemaining > 0 : state.hintsRemaining > 0;
}

/**
 * Consume 1 Hint or 1 Undo token independently.
 */
export function consumeAssist(
  state: MatchAssistsState,
  kind: AssistKind = 'hint'
): {
  next: MatchAssistsState;
  ok: boolean;
} {
  if (kind === 'undo') {
    if (state.undosRemaining <= 0) {
      return { next: state, ok: false };
    }
    const nextUndos = state.undosRemaining - 1;
    return {
      next: {
        ...state,
        undosRemaining: nextUndos,
        used: state.used + 1,
      },
      ok: true,
    };
  }

  if (state.hintsRemaining <= 0) {
    return { next: state, ok: false };
  }
  const nextHints = state.hintsRemaining - 1;
  return {
    next: {
      ...state,
      hintsRemaining: nextHints,
      remaining: nextHints,
      used: state.used + 1,
    },
    ok: true,
  };
}

/**
 * Check if the player is eligible to refill Hints or Undos via a Rewarded Ad in this match.
 */
export function canRefillAssists(
  state: MatchAssistsState,
  kind: AssistKind = 'hint'
): boolean {
  if (state.isPremium) {
    return false;
  }
  return kind === 'undo'
    ? state.undoRefillsUsed < MAX_AD_REFILLS_PER_MATCH
    : state.hintRefillsUsed < MAX_AD_REFILLS_PER_MATCH;
}

/**
 * Refill Hints or Undos (via Rewarded Ad completion for free users).
 */
export function refillAssists(
  state: MatchAssistsState,
  kind: AssistKind = 'hint'
): MatchAssistsState {
  if (state.isPremium) {
    return state;
  }
  if (kind === 'undo') {
    if (state.undoRefillsUsed >= MAX_AD_REFILLS_PER_MATCH) {
      return state;
    }
    const nextUndoRefills = state.undoRefillsUsed + 1;
    return {
      ...state,
      undosRemaining: state.undosRemaining + REFILL_ASSISTS_GRANT,
      undoRefillsUsed: nextUndoRefills,
    };
  }

  if (state.hintRefillsUsed >= MAX_AD_REFILLS_PER_MATCH) {
    return state;
  }
  const nextHintRefills = state.hintRefillsUsed + 1;
  const nextHints = state.hintsRemaining + REFILL_ASSISTS_GRANT;
  return {
    ...state,
    hintsRemaining: nextHints,
    remaining: nextHints,
    hintRefillsUsed: nextHintRefills,
    refillsUsed: nextHintRefills,
  };
}

/**
 * Returns whether using an assist right now will drop the player from 3-star to 2-star eligibility.
 */
export function willForfeitThreeStars(state: MatchAssistsState): boolean {
  return state.used === 0;
}
