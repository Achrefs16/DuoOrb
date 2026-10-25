/**
 * Ad runtime boundary (MONETIZATION.md P3.5 / P6).
 *
 * All ad SDK calls go through this module — screens never import
 * `react-native-google-mobile-ads` directly. That keeps placements (P6: O1–O3
 * sign-off) tunable via ADS_CONFIG and lets P3 build the rewarded unlock flow
 * against a mock provider before AdMob approval exists.
 *
 * Provider ladder:
 * - default: UnavailableProvider — every call resolves `{ earned: false,
 *   error: 'unavailable' }`. Fail-closed: gates render "unavailable" rows,
 *   the app never hangs and nothing is silently granted.
 * - tests/dev: MockGrantingProvider / MockDenyingProvider via setAdProvider.
 * - P6: the real SDK provider (preload + show + reward listener).
 */

export interface RewardedResult {
  earned: boolean;
  /** Machine-readable: 'unavailable' | 'dismissed' | 'error'. */
  error?: string;
}

export type RewardedPlacement = 'analysis' | 'undo';

export interface AdProvider {
  showRewarded(placement: RewardedPlacement): Promise<RewardedResult>;
  preloadRewarded?(placement: RewardedPlacement): void;
}

/**
 * App-wide, retention-safe ad pacing. Every number is tunable here so the
 * algorithm can be retuned without touching screens or the SDK boundary.
 *
 * Principles:
 * - Never interrupt a live match, never fire on Rematch.
 * - Only show after positive/neutral transitions, never after a loss streak.
 * - Stand down for 3 minutes after a voluntary rewarded view.
 * - The first completed win of the first session is eligible, because the
 *   player has already invested time and chosen to continue.
 */
export const ADS_CONFIG = {
  /** Rewarded placements currently offered. */
  rewardedPlacements: ['analysis', 'undo'] as const,
  interstitialEnabled: true,
  /** Eligible after the 1st completed win. */
  interstitialMinGames: 1,
  /** Post-loss interstitials wait for a 2nd completed game. */
  interstitialMinGamesAfterLoss: 2,
  interstitialMaxPerDay: 8,
  /** 75s cooldown while the player is in the high-dopamine win state. */
  interstitialWinGapSec: 75,
  /** 150s cooldown on neutral transitions. */
  interstitialNeutralGapSec: 150,
  /** 3-minute immunity after watching a rewarded video. */
  interstitialRewardedShieldSec: 180,
  /** Skip instant resigns/aborts; quick real matches still count. */
  interstitialMinGameSec: 20,
  /** Tilt protection: never show on a 2+ loss streak. */
  maxConsecutiveLossesForAd: 1,
  /** The first completed win is eligible, even in session one. */
  skipFirstSession: false,
} as const;

const UnavailableProvider: AdProvider = {
  async showRewarded(): Promise<RewardedResult> {
    return { earned: false, error: 'unavailable' };
  },
  preloadRewarded(): void {},
};

export const MockGrantingProvider: AdProvider = {
  async showRewarded(): Promise<RewardedResult> {
    return { earned: true };
  },
  preloadRewarded(): void {},
};

export const MockDenyingProvider: AdProvider = {
  async showRewarded(): Promise<RewardedResult> {
    return { earned: false, error: 'dismissed' };
  },
  preloadRewarded(): void {},
};

let provider: AdProvider = UnavailableProvider;

/** Epoch ms of the last rewarded SHOW (earned or not): interstitials stand
 * down for the gap window after any rewarded view — never two ads in a row.
 */
let lastRewardedAtMs: number | null = null;

export function lastRewardedShownAt(): number | null {
  return lastRewardedAtMs;
}

export function setAdProvider(next: AdProvider): void {
  provider = next;
}

export function __resetAdProviderForTests(): void {
  provider = UnavailableProvider;
  lastRewardedAtMs = null;
}

/** Best-effort warm-up; safe to call before any show. Never throws. */
export function preloadRewarded(placement: RewardedPlacement): void {
  try {
    provider.preloadRewarded?.(placement);
  } catch {
    // Preload is advisory — a failure must never break the game flow.
  }
}

/**
 * Shows a rewarded ad for a placement. ALWAYS resolves (never rejects):
 * early-close/no-fill/SDK errors come back as `{ earned: false, error }`
 * so callers can render the right row (E10/E11).
 */
export async function showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
  try {
    const res = await provider.showRewarded(placement);
    if (res && res.earned === true) {
      // Only a completed view earns the interstitial shield. A failed load or
      // early close must never suppress ads for the next three minutes.
      lastRewardedAtMs = Date.now();
      return { earned: true };
    }
    return { earned: false, error: res?.error ?? 'dismissed' };
  } catch {
    return { earned: false, error: 'error' };
  }
}
