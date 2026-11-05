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
    initializeAndOpenPlayer?: (options: Record<string, unknown>) => void;
  }
}

/**
 * Unified AppLixir In-Game Video Ad Runner (PWA Web)
 * Handles both rewarded videos (bot unlocks, hints, undos, analysis) and interstitials.
 */
async function playAppLixirAd(placement: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const getAppLixir = (): ((options: Record<string, unknown>) => void) | null => {
    if (typeof window.initializeAndOpenPlayer === 'function') {
      return window.initializeAndOpenPlayer;
    }
    return null;
  };

  let playerFn = getAppLixir();
  if (!playerFn) {
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 100));
      playerFn = getAppLixir();
      if (playerFn) break;
    }
  }

  if (!playerFn) {
    return true; // Graceful fallback
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let earned = false;

    const cleanupAdContainer = () => {
      try {
        const container = document.getElementById('applixir-ad-container');
        if (container) {
          container.classList.remove('applixir-active');
          container.style.display = 'none';
          container.innerHTML = '';
        }
        const strays = document.querySelectorAll(
          '[id*="applixir"]:not(#applixir-ad-container), [class*="applixir"]'
        );
        strays.forEach((el) => el.remove());
      } catch (e) {
        console.warn('AppLixir cleanup error:', e);
      }
    };

    const finish = (result: boolean) => {
      if (!settled) {
        settled = true;
        clearTimeout(safetyTimer);
        cleanupAdContainer();
        setTimeout(cleanupAdContainer, 150);
        setTimeout(cleanupAdContainer, 400);
        resolve(result);
      }
    };

    const safetyTimer = setTimeout(() => {
      finish(true);
    }, 60000);

    try {
      const container = document.getElementById('applixir-ad-container');
      if (container) {
        container.classList.add('applixir-active');
        container.style.display = 'block';
      }

      const options = {
        apiKey: '5a4db0c5-0000-4000-8000-5a4db0c50001',
        injectionElementId: 'applixir-ad-container',
        adStatusCallbackFn: (status: any) => {
          const statusType = typeof status === 'object' ? status?.type : status;
          if (statusType === 'complete' || statusType === 'adDone') {
            earned = true;
          } else if (
            statusType === 'close' ||
            statusType === 'adDismissed' ||
            statusType === 'userCanceled' ||
            statusType === 'manuallyEnded' ||
            statusType === 'allAdsCompleted'
          ) {
            finish(earned || statusType === 'allAdsCompleted');
          }
        },
        adErrorCallbackFn: (error: any) => {
          console.warn('AppLixir Ad error:', error);
          finish(true);
        },
      };

      playerFn(options);
    } catch (e) {
      console.warn('AppLixir invoke error:', e);
      finish(true);
    }
  });
}

class WebAdSenseProvider implements AdProvider {
  preloadRewarded(): void {
    // Best-effort pre-warm
  }

  async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
    if (typeof window === 'undefined') {
      return { earned: false, error: 'unavailable' };
    }

    const earned = await playAppLixirAd(placement || 'reward');
    return { earned, error: earned ? undefined : 'dismissed' };
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
  if (typeof window !== 'undefined') {
    return playAppLixirAd('interstitial');
  }
  return false;
}
