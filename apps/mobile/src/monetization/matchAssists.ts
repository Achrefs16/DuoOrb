/**
 * Match Assists Economy (Hints & Undos "Lives" system).
 *
 * Scope:
 * - Active strictly in vs AI (Offline/Bots) and Local Practice.
 * - 100% disabled in Online Ranked / Quick Match (competitive integrity).
 *
 * Rules:
 * - Free tier: starts with 1 assist per match.
 *   Can watch a rewarded video ad for +3 assists (max 2 ad refills per match).
 * - Premium tier: starts with 9 assists per match.
 *   Instant ad-free refills up to the 9-assist cap.
 * - Star rating synergy:
 *   0 assists used = 3 Stars ⭐️⭐️⭐️
 *   1 assist used  = 2 Stars ⭐️⭐️
 *   2+ assists used = 1 Star ⭐️
 */

export const FREE_STARTING_ASSISTS = 1;
export const PREMIUM_STARTING_ASSISTS = 9;
export const REFILL_ASSISTS_GRANT = 3;
export const MAX_AD_REFILLS_PER_MATCH = 2;

export interface MatchAssistsState {
  /** Remaining assist tokens available in the current match */
  remaining: number;
  /** Total assists consumed so far in the current match (drives bot mastery stars) */
  used: number;
  /** Number of refills redeemed in this match */
  refillsUsed: number;
  /** Whether the user has DuoOrb Premium */
  isPremium: boolean;
}

/**
 * Initialize a fresh assists pool at the start of a match.
 */
export function createMatchAssists(isPremium: boolean): MatchAssistsState {
  return {
    remaining: isPremium ? PREMIUM_STARTING_ASSISTS : FREE_STARTING_ASSISTS,
    used: 0,
    refillsUsed: 0,
    isPremium,
  };
}

/**
 * Check if the player has at least one assist available to spend immediately.
 */
export function canUseAssist(state: MatchAssistsState): boolean {
  return state.remaining > 0;
}

/**
 * Consume 1 assist token for a Hint or Undo.
 */
export function consumeAssist(state: MatchAssistsState): {
  next: MatchAssistsState;
  ok: boolean;
} {
  if (state.remaining <= 0) {
    return { next: state, ok: false };
  }
  return {
    next: {
      ...state,
      remaining: state.remaining - 1,
      used: state.used + 1,
    },
    ok: true,
  };
}

/**
 * Check if the player is eligible to refill assists in this match.
 */
export function canRefillAssists(state: MatchAssistsState): boolean {
  if (state.isPremium) {
    return state.remaining < PREMIUM_STARTING_ASSISTS;
  }
  return state.refillsUsed < MAX_AD_REFILLS_PER_MATCH;
}

/**
 * Refill assists (via Rewarded Ad completion for free users, or instant for Premium).
 */
export function refillAssists(state: MatchAssistsState): MatchAssistsState {
  if (state.isPremium) {
    return {
      ...state,
      remaining: PREMIUM_STARTING_ASSISTS,
      refillsUsed: state.refillsUsed + 1,
    };
  }
  return {
    ...state,
    remaining: state.remaining + REFILL_ASSISTS_GRANT,
    refillsUsed: state.refillsUsed + 1,
  };
}

/**
 * Returns whether using an assist right now will drop the player from 3-star to 2-star eligibility.
 */
export function willForfeitThreeStars(state: MatchAssistsState): boolean {
  return state.used === 0;
}
