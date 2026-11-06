import { setAdProvider, type AdProvider, type RewardedPlacement, type RewardedResult } from './ads';

/**
 * Web twin of `adsNative.ts` (MONETIZATION.md P6 / Web AdSense).
 *
 * Metro resolves this file INSTEAD of `adsNative.ts` on web.
 * Provides instant rewarded access on Web without heavy external third-party SDK bloat.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (params: Record<string, unknown>) => void;
    adConfig?: (params: Record<string, unknown>) => void;
  }
}

class WebAdSenseProvider implements AdProvider {
  preloadRewarded(): void {
    // No-op for web
  }

  async showRewarded(_placement: RewardedPlacement): Promise<RewardedResult> {
    if (typeof window === 'undefined') {
      return { earned: false, error: 'unavailable' };
    }
    // Web grants instant rewarded access (bot hints, undos, analysis) with zero blocker ads
    return { earned: true };
  }
}

export function ensureAdsReady(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return Promise.resolve(true);
}

export function installRealAds(): boolean {
  if (typeof window === 'undefined') return false;
  setAdProvider(new WebAdSenseProvider());
  return true;
}

export function getBannerLib(): null {
  return null;
}

/** Web preload for transitions. */
export function preloadInterstitial(): Promise<boolean> {
  if (typeof window !== 'undefined') return Promise.resolve(true);
  return Promise.resolve(false);
}

export async function showInterstitial(): Promise<boolean> {
  // Seamless web experience: no disruptive popups
  return false;
}
