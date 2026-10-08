import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADS_CONFIG, lastRewardedShownAt } from './ads';
import { showInterstitial } from './adsNative';

/**
 * Win-only interstitial (MONETIZATION.md P6, O1–O3 revised).
 *
 * Single trigger: the result-modal EXIT (user leaves the finished match for
 * its origin surface). Never on modal open (rematch/replay/analyze still in
 * play), never mid-match, never at app start, never after a loss, and never
 * back-to-back with a rewarded view.
 *
 * Caps come from ADS_CONFIG (retune without code changes):
 * - minGames(2): games finished before the first interstitial
 * - maxPerDay(3), minGapSec(180), minGameSec(60), skipFirstSession
 */

const GAMES_KEY = '@duoorb:interstitial-games:v1';
const DAY_PREFIX = '@duoorb:interstitial-day:v1:';
const LAST_KEY = '@duoorb:interstitial-last:v1:';

export interface InterstitialContext {
  isPremium: boolean;
  /** App sessions (skipFirstSession: nothing before session 2). */
  sessions: number;
  /** The viewer won this match — losses never show. */
  userWon: boolean;
  /** Finished game length in seconds. */
  gameSec: number;
}

interface InterstitialState {
  gamesFinished: number;
  shownToday: number;
  lastShownAtMs: number | null;
  lastRewardedAtMs: number | null;
  now: number;
}

/** Pure rule table (unit-tested); storage + SDK stay in showInterstitialIfDue. */
export function shouldShowInterstitial(
  ctx: InterstitialContext,
  state: InterstitialState
): boolean {
  if (ctx.isPremium) return false;
  if (ADS_CONFIG.skipFirstSession && ctx.sessions < 2) return false;
  if (!ctx.userWon) return false;
  if (ctx.gameSec < ADS_CONFIG.interstitialMinGameSec) return false;
  if (state.gamesFinished < ADS_CONFIG.interstitialMinGames) return false;
  if (state.shownToday >= ADS_CONFIG.interstitialMaxPerDay) return false;
  if (
    state.lastShownAtMs != null &&
    state.now - state.lastShownAtMs < ADS_CONFIG.interstitialMinGapSec * 1000
  ) {
    return false;
  }
  // Never two ads in a row: a recent rewarded view suppresses.
  if (
    state.lastRewardedAtMs != null &&
    state.now - state.lastRewardedAtMs < ADS_CONFIG.interstitialMinGapSec * 1000
  ) {
    return false;
  }
  return true;
}

function dayKey(now: number): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${DAY_PREFIX}${y}-${m}-${day}`;
}

async function readNum(key: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export interface InterstitialDeps {
  showAd?: () => Promise<boolean>;
}

/**
 * Records the finished game, then shows when every rule passes. Resolves
 * false on any suppression or SDK failure — callers fire-and-forget.
 */
export async function showInterstitialIfDue(
  ctx: InterstitialContext,
  deps: InterstitialDeps = {}
): Promise<boolean> {
  try {
    const now = Date.now();
    const gamesFinished = (await readNum(GAMES_KEY)) + 1;
    try {
      await AsyncStorage.setItem(GAMES_KEY, JSON.stringify(gamesFinished));
    } catch {
      // Counter hygiene must never break the flow.
    }
    const state: InterstitialState = {
      gamesFinished,
      shownToday: await readNum(dayKey(now)),
      lastShownAtMs: (await readNum(LAST_KEY)) || null,
      lastRewardedAtMs: lastRewardedShownAt(),
      now,
    };
    if (!shouldShowInterstitial(ctx, state)) return false;
    const shown = await (deps.showAd ?? showInterstitial)();
    if (!shown) return false;
    try {
      await AsyncStorage.setItem(dayKey(now), JSON.stringify(state.shownToday + 1));
      await AsyncStorage.setItem(LAST_KEY, JSON.stringify(now));
    } catch {
      // Count hygiene must never break the flow.
    }
    return true;
  } catch {
    return false;
  }
}
