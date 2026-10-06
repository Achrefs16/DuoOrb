/**
 * AdMob unit IDs (MONETIZATION.md P0.1).
 *
 * Production builds use the real DuoOrb units. `__DEV__` builds use Google's
 * demo units unconditionally: tapping a REAL ad from a dev phone risks an
 * invalid-traffic suspension, and the registered test device only rewrites
 * traffic for the IDs it serves — demo units remove the question entirely.
 */

export const ADMOB_APP_ID = 'ca-app-pub-6057010656402010~3789437235';

const PROD_UNITS = {
  banner: 'ca-app-pub-6057010656402010/8570242197',
  rewarded: 'ca-app-pub-6057010656402010/6459084176',
} as const;

// Google demo units (docs: "not associated with your AdMob account, so
// there's no risk of invalid traffic"). Banner uses the ADAPTIVE demo ID to
// match adaptive banner inventory (fixed-size IDs no-fill there).
const DEMO_UNITS = {
  banner: 'ca-app-pub-3940256099942544/9214589741',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

export type AdUnitKind = keyof typeof PROD_UNITS;

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

/** Pure selection (unit-tested); callers never branch on __DEV__ themselves. */
export function selectAdUnitId(kind: AdUnitKind, dev: boolean): string {
  return dev ? DEMO_UNITS[kind] : PROD_UNITS[kind];
}

export function adUnitId(kind: AdUnitKind): string {
  return selectAdUnitId(kind, isDev());
}
