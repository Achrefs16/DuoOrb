import { Platform } from 'react-native';
import {
  setAdProvider,
  type AdProvider,
  type RewardedResult,
} from './ads';
import { adUnitId } from './adIds';
import { track } from './analytics';

/**
 * Native-only AdMob access (MONETIZATION.md P6).
 *
 * Platform boundary: Metro resolves `adsNative.web.ts` on web, so this file
 * (and the native SDK it requires) is NEVER bundled for browsers — a lazy
 * require alone was not enough, because Metro follows require() at bundle
 * time and the SDK pulls React internals that do not exist on web.
 *
 * Web / Expo Go / missing native module: every entry returns null/false and
 * the app keeps failing closed on UnavailableProvider.
 */

// Untyped by necessity: the SDK surface is only reflectively known through
// the lazy require, so no importable type exists.
type Sdk = any;

function loadSdk(): Sdk | null {
  if (Platform.OS === 'web') return null;
  // iOS has no AdMob app registered yet (no iosAppId in app.json): the native
  // SDK crashes on initialize() without one. Stay dark on iOS until the iOS
  // AdMob app exists and the plugin carries its ID — then delete this branch.
  if (Platform.OS === 'ios') return null;
  try {
    // Plain require, executed only here: dev builds succeed; anything without
    // the native module throws and we stay dark.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

let readyPromise: Promise<boolean> | null = null;

export function ensureAdsReady(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const sdk = loadSdk();
        if (!sdk) return false;
        try {
          await sdk.AdsConsent.requestInfoUpdate();
          const info = await sdk.AdsConsent.getConsentInfo?.();
          void info;
          await sdk.AdsConsent.loadAndShowConsentFormIfRequired?.();
        } catch {
          // Consent flow is best-effort: a failure here must not block ads
          // where consent isn't required (the UMP backend decides).
        }
        sdk
          .mobileAds()
          .setRequestConfiguration({ maxAdContentRating: sdk.MaxAdContentRating.G });
        await sdk.mobileAds().initialize();
        return true;
      } catch {
        return false;
      }
    })().then((ok) => {
      // A `false` is transient until proven otherwise (offline boot is the
      // classic case) — drop it so the next show retries instead of staying
      // dark for the whole session. `true` stays cached.
      if (!ok) readyPromise = null;
      return ok;
    });
  }
  return readyPromise;
}

const LOAD_TIMEOUT_MS = 12_000;

class RealRewardedProvider implements AdProvider {
  private sdk: Sdk;
  private unitId: string;
  // Untyped by necessity: the SDK class surface is only reflectively known
  // through the lazy require (web/Go safety), so no importable type exists.
  private ad: any | null = null;
  private inflight: Promise<RewardedResult> | null = null;
  // Load serialization — preload (fire-and-forget) racing a show must share
  // one load, never mint two instances with crossed listeners.
  private loading: Promise<boolean> | null = null;

  constructor(sdk: Sdk, unitId: string) {
    this.sdk = sdk;
    this.unitId = unitId;
  }

  preloadRewarded(): void {
    void this.ensureLoaded().catch(() => {});
  }

  showRewarded(): Promise<RewardedResult> {
    if (this.inflight) return this.inflight;
    this.inflight = this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async run(): Promise<RewardedResult> {
    try {
      const ready = await ensureAdsReady();
      if (!ready) return { earned: false, error: 'unavailable' };
      const loaded = await this.ensureLoaded();
      if (!loaded) return { earned: false, error: 'unavailable' };
      return await this.present();
    } catch {
      return { earned: false, error: 'error' };
    }
  }

  private async ensureLoaded(): Promise<boolean> {
    const ready = await ensureAdsReady();
    if (!ready) return false;
    if (this.ad?.loaded) return true;
    if (!this.loading) {
      this.loading = this.loadFresh().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  private async loadFresh(): Promise<boolean> {
    try {
      // Drop the previous instance first so a just-shown ad's listeners can
      // never fire into a later show (destroy is best-effort).
      try {
        this.ad?.destroy?.();
      } catch {
        // Teardown hygiene only — the new load proceeds regardless.
      }
      this.ad = this.sdk.RewardedAd.createForAdRequest(this.unitId);
      const done = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
        const unsubs: (() => void)[] = [];
        const cleanup = () => {
          clearTimeout(timer);
          unsubs.forEach((u) => {
            try {
              u();
            } catch {
              // Listener teardown is best-effort.
            }
          });
        };
        unsubs.push(
          this.ad.addAdEventListener(this.sdk.RewardedAdEventType.LOADED, () => {
            cleanup();
            resolve(true);
          })
        );
        unsubs.push(
          this.ad.addAdEventListener(this.sdk.AdEventType.ERROR, () => {
            cleanup();
            resolve(false);
          })
        );
      });
      this.ad.load();
      return await done;
    } catch {
      return false;
    }
  }

  private present(): Promise<RewardedResult> {
    return new Promise((resolve) => {
      let earned = false;
      let settled = false;
      const finish = (res: RewardedResult) => {
        if (settled) return;
        settled = true;
        // Warm the next one while the user reads the unlocked content.
        // Destroy the shown instance first (native hygiene), then reload.
        try {
          const shown = this.ad;
          this.ad = null;
          try {
            shown?.destroy?.();
          } catch {
            // Teardown hygiene only.
          }
          this.preloadRewarded();
        } catch {
          // Warm-up failure surfaces on the next show, never here.
        }
        resolve(res);
      };
      try {
        this.ad.addAdEventListener(this.sdk.RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
          track('reward_completed', { placement: 'analysis' });
        });
        this.ad.addAdEventListener(this.sdk.AdEventType.CLOSED, () => {
          finish(earned ? { earned: true } : { earned: false, error: 'dismissed' });
        });
        this.ad.addAdEventListener(this.sdk.AdEventType.ERROR, () => {
          finish({ earned: false, error: 'error' });
        });
        void Promise.resolve(this.ad.show()).catch(() => {
          finish({ earned: false, error: 'error' });
        });
      } catch {
        finish({ earned: false, error: 'error' });
      }
    });
  }
}

/**
 * Installs the real provider when the native SDK exists, once per launch.
 * Safe everywhere: returns false (leaving UnavailableProvider) on web,
 * Expo Go, iOS (no App ID yet), and init failure. Call from the App boot effect.
 */
export function installRealAds(): boolean {
  try {
    const sdk = loadSdk();
    if (!sdk) return false;
    setAdProvider(new RealRewardedProvider(sdk, adUnitId('rewarded')));
    void ensureAdsReady().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export interface BannerLib {
  // Untyped by necessity (same lazy-require boundary as Sdk above).
  BannerAd: any;
  BannerAdSize: any;
}

/**
 * Banner component handle for AdBanner (shape-validated: a resolvable but
 * broken module must keep the slot empty, never crash the screen).
 */
export function getBannerLib(): BannerLib | null {
  const sdk = loadSdk();
  if (
    !sdk ||
    typeof sdk.BannerAd === 'undefined' ||
    sdk.BannerAdSize == null
  ) {
    return null;
  }
  return { BannerAd: sdk.BannerAd, BannerAdSize: sdk.BannerAdSize };
}
