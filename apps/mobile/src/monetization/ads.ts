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

export interface AdProvider {
  showRewarded(placement: string): Promise<RewardedResult>;
  preloadRewarded?(placement: string): void;
}

export const ADS_CONFIG = {
  /** Rewarded placements currently offered. 'analysis' = full game analysis. */
  rewardedPlacements: ['analysis'] as const,
  // Interstitial defaults (P6 placement sign-off O1–O3 still pending; the
  // manager enforces whatever ships here — no code changes to retune).
  interstitialEnabled: true,
  interstitialMinGames: 2,
  interstitialMaxPerDay: 3,
  interstitialMinGapSec: 180,
  interstitialMinGameSec: 60,
  skipFirstSession: true,
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

export function setAdProvider(next: AdProvider): void {
  provider = next;
}

export function __resetAdProviderForTests(): void {
  provider = UnavailableProvider;
}

/** Best-effort warm-up; safe to call before any show. Never throws. */
export function preloadRewarded(placement: string): void {
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
export async function showRewarded(placement: string): Promise<RewardedResult> {
  try {
    const res = await provider.showRewarded(placement);
    if (res && res.earned === true) return { earned: true };
    return { earned: false, error: res?.error ?? 'dismissed' };
  } catch {
    return { earned: false, error: 'error' };
  }
}
