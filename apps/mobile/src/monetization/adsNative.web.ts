import { setAdProvider, type AdProvider, type RewardedPlacement, type RewardedResult } from './ads';

/**
 * Web twin of `adsNative.ts` (MONETIZATION.md P6 / Web AdSense).
 *
 * Metro resolves this file INSTEAD of `adsNative.ts` on web. It provides
 * integration with Google AdSense / H5 Games Ads API (`adBreak`) without
 * pulling native Android/iOS mobile SDKs into the browser bundle.
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
    // Best-effort pre-warm
  }

  showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
    if (typeof window === 'undefined') {
      return Promise.resolve({ earned: false, error: 'unavailable' });
    }

    // 1. Google H5 Games Ads API (adBreak) if configured
    if (typeof window.adBreak === 'function') {
      return new Promise<RewardedResult>((resolve) => {
        let granted = false;
        try {
          window.adBreak!({
            type: 'reward',
            name: placement || 'analysis',
            beforeReward: (showAdFn: () => void) => {
              showAdFn();
            },
            adDismissed: () => {
              if (!granted) resolve({ earned: false, error: 'dismissed' });
            },
            adViewed: () => {
              granted = true;
              resolve({ earned: true });
            },
            adBreakDone: () => {
              if (!granted) resolve({ earned: false, error: 'dismissed' });
            },
          });
        } catch {
          resolve({ earned: false, error: 'error' });
        }
      });
    }

    // 2. Web PWA Monetag Flow:
    // User requested Analysis, Hints, or Undos: grant reward earned
    return Promise.resolve({ earned: true });
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

export function showInterstitial(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    if (typeof window.adBreak === 'function') {
      return new Promise((resolve) => {
        try {
          window.adBreak!({
            type: 'next',
            name: 'game_over',
            adBreakDone: () => resolve(true),
          });
        } catch {
          resolve(false);
        }
      });
    }
    // Web / Monetag Vignette handles visual presentation on transition clicks
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
