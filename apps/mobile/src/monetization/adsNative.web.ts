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

class WebAdSenseProvider implements AdProvider {
  preloadRewarded(): void {
    // Best-effort pre-warm
  }

  async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
    if (typeof window === 'undefined') {
      return { earned: false, error: 'unavailable' };
    }

    // 1. AppLixir In-Game Rewarded Video Ad (PWA / Web)
    // Plays video ad overlay directly on the game canvas. Player stays 100% on site!
    const getAppLixir = (): ((options: Record<string, unknown>) => void) | null => {
      if (typeof window.initializeAndOpenPlayer === 'function') {
        return window.initializeAndOpenPlayer;
      }
      return null;
    };

    let playerFn = getAppLixir();
    // If SDK is still downloading asynchronously, wait briefly
    if (!playerFn) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 100));
        playerFn = getAppLixir();
        if (playerFn) break;
      }
    }

    if (playerFn) {
      return new Promise<RewardedResult>((resolve) => {
        let settled = false;
        let rewardEarned = false;

        const cleanupAdContainer = () => {
          try {
            const container = document.getElementById('applixir-ad-container');
            if (container) {
              container.classList.remove('applixir-active');
              container.style.display = 'none';
              container.style.pointerEvents = 'none';
              container.innerHTML = '';
            }
            // Remove any residual floating iframes or backdrop elements created by AppLixir
            const strayElements = document.querySelectorAll(
              '[id*="applixir"]:not(#applixir-ad-container), [class*="applixir"], iframe[src*="applixir"]'
            );
            strayElements.forEach((el) => el.remove());
          } catch (e) {
            console.warn('AppLixir cleanup error:', e);
          }
        };

        const finishAndResolve = (res: RewardedResult) => {
          if (!settled) {
            settled = true;
            clearTimeout(safetyTimer);
            cleanupAdContainer();
            // Staggered cleanups ensure any animation or late frame teardown doesn't re-lock touch
            setTimeout(cleanupAdContainer, 100);
            setTimeout(cleanupAdContainer, 400);
            resolve(res);
          }
        };

        // Safety timeout so user is never stuck indefinitely
        const safetyTimer = setTimeout(() => {
          finishAndResolve({ earned: rewardEarned || true });
        }, 45000);

        try {
          const container = document.getElementById('applixir-ad-container');
          if (container) {
            container.classList.add('applixir-active');
            container.style.display = 'flex';
            container.style.pointerEvents = 'auto';
          }

          const options = {
            apiKey: '5a4db0c5-0000-4000-8000-5a4db0c50001',
            injectionElementId: 'applixir-ad-container',
            adStatusCallbackFn: (status: any) => {
              const statusType = typeof status === 'object' ? status?.type : status;
              if (statusType === 'complete' || statusType === 'adDone') {
                rewardEarned = true;
                // Auto-cleanup shortly after complete in case player doesn't dispatch a separate close event
                setTimeout(() => {
                  finishAndResolve({ earned: true });
                }, 1200);
              } else if (
                statusType === 'close' ||
                statusType === 'adDismissed' ||
                statusType === 'userCanceled'
              ) {
                finishAndResolve({
                  earned: rewardEarned,
                  error: rewardEarned ? undefined : 'dismissed',
                });
              }
            },
            adErrorCallbackFn: (error: any) => {
              console.warn('AppLixir Ad error:', error);
              // Graceful fallback if ad blocker prevents playback
              finishAndResolve({ earned: true });
            },
          };
          playerFn(options);
        } catch (e) {
          console.warn('AppLixir invoke error:', e);
          finishAndResolve({ earned: true });
        }
      });
    }

    // 2. Google H5 Games Ads API (adBreak) if present and real
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

    // Graceful fallback if neither SDK is active
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
