/**
 * Web twin of `adsNative.ts` (MONETIZATION.md P6).
 *
 * Metro resolves this file INSTEAD of `adsNative.ts` on web, so the native
 * AdMob SDK is never bundled for browsers (bundling it fails the whole web
 * build — it pulls React internals that do not exist on web). Every entry
 * degrades to "no ads", and the app's gates keep failing closed.
 */

export function ensureAdsReady(): Promise<boolean> {
  return Promise.resolve(false);
}

export function installRealAds(): boolean {
  return false;
}

export function getBannerLib(): null {
  return null;
}

export function showInterstitial(): Promise<boolean> {
  return Promise.resolve(false);
}
