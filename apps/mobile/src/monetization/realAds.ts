import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ads launch state + banner visibility (MONETIZATION.md P6).
 *
 * Pure module: no native SDK imports, so it bundles everywhere (web, Go, dev
 * builds). Everything that touches `react-native-google-mobile-ads` lives in
 * `adsNative.ts` (+ its `.web.ts` twin) behind the platform boundary.
 */

const ADS_STORE_KEY = '@duoorb:ads:v1';
const COMPLETED_GAMES_KEY = '@duoorb:interstitial-games:v1';

export async function getCompletedGamesCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_GAMES_KEY);
    if (!raw) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export async function recordAppSession(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ADS_STORE_KEY);
    const sessions = raw ? (JSON.parse(raw) as { sessions?: number }).sessions ?? 0 : 0;
    const next = sessions + 1;
    await AsyncStorage.setItem(ADS_STORE_KEY, JSON.stringify({ sessions: next }));
    sessionCount = next;
    return next;
  } catch {
    return 1;
  }
}

let sessionCount = 0;
let recordedThisLaunch = false;

/** Last known session count (0 until recorded — banners stay hidden). */
export function getSessionCount(): number {
  return sessionCount;
}

/** Idempotent per launch: many banners mount, only one increment happens. */
export async function ensureSessionRecorded(): Promise<number> {
  if (recordedThisLaunch) return sessionCount;
  recordedThisLaunch = true;
  return recordAppSession();
}

/** Test seam: reset launch guards without touching disk. */
export function __resetAdsSessionForTests(): void {
  sessionCount = 0;
  recordedThisLaunch = false;
}

/** Pure visibility rule (unit-tested): premium/launcher/session-zero/failure/games-threshold. */
export function shouldShowBanner(opts: {
  isPremium: boolean;
  sessions: number;
  completedGames?: number;
  loadFailed: boolean;
  keepReservedSpaceOnFail?: boolean;
}): boolean {
  if (opts.isPremium) return false;
  if (opts.sessions < 1) return false;
  if (opts.completedGames != null && opts.completedGames < 2) return false;
  if (opts.loadFailed && !opts.keepReservedSpaceOnFail) return false;
  return true;
}
