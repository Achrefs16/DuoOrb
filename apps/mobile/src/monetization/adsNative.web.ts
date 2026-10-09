import { setAdProvider, type AdProvider, type RewardedResult } from './ads';

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
    // Best-effort pre-warm for Google H5 Games Ads
  }

  showRewarded(placement: string): Promise<RewardedResult> {
    if (typeof window === 'undefined') {
      return Promise.resolve({ earned: false, error: 'unavailable' });
    }

    // Google H5 Games Ads API (adBreak)
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

    // Graceful fallback while AdSense domain is in review or if H5 adBreak is not initialized
    return Promise.resolve({ earned: false, error: 'unavailable' });
  }
}

export function ensureAdsReady(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const isLoaded = Boolean(window.adsbygoogle || window.adBreak);
  return Promise.resolve(isLoaded);
}

export function installRealAds(): boolean {
  if (typeof window === 'undefined') return false;
  setAdProvider(new WebAdSenseProvider());
  return true;
}

export function getBannerLib(): null {
  return null;
}

export function showInterstitial(): Promise<boolean> {
  if (typeof window !== 'undefined' && typeof window.adBreak === 'function') {
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
  return Promise.resolve(false);
}
