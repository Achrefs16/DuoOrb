import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADS_CONFIG, lastRewardedShownAt } from './ads';
import { showInterstitial } from './adsNative';

/**
 * App-wide, retention-safe interstitial pacing (MONETIZATION.md P6, revised).
 *
 * The engine never touches gameplay. It decides on *transition* moments:
 * - `new_match`: the result modal's New Match button (online quick/custom).
 * - `close_match`: Close Match, or Back from the final board.
 * - Rematch is deliberately absent: accepting a rematch is never interrupted.
 *
 * Rules, in order:
 * 1. Premium never sees interstitials.
 * 2. Aborted matches under 20s never count or show.
 * 3. 2+ consecutive losses suppress all interstitials (tilt protection), and
 *    a loss never shows on Close Match — only when actively starting a new,
 *    long-enough match after a first loss.
 * 4. A rewarded view grants a 3-minute ad-free shield.
 * 5. Adaptive cooldown: 75s after a win, 150s on neutral transitions.
 * 6. Daily cap: 8.
 */

const GAMES_KEY = '@duoorb:interstitial-games:v1';
const LOSSES_KEY = '@duoorb:interstitial-losses:v1';
const LAST_GAME_KEY = '@duoorb:interstitial-last-game:v1';
const DAY_PREFIX = '@duoorb:interstitial-day:v1:';
const LAST_KEY = '@duoorb:interstitial-last:v1:';

export type AdTransitionTrigger = 'new_match' | 'close_match' | 'room_exit';

export interface GameFinishedOutcome {
  userWon: boolean;
  /** Finished game length in seconds. */
  gameSec: number;
  /** Stable match id; makes recording idempotent across re-renders. */
  gameId?: string;
}

export interface InterstitialContext {
  isPremium: boolean;
  /** App sessions (skipFirstSession: nothing before session 2). */
  sessions: number;
  /** The viewer won this match. */
  userWon: boolean;
  /** Finished game length in seconds. */
  gameSec: number;
  /** Which transition asked for the ad. Omitted = close_match. */
  trigger?: AdTransitionTrigger;
}

interface InterstitialState {
  gamesFinished: number;
  consecutiveLosses: number;
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
  if (!ADS_CONFIG.interstitialEnabled) return false;
  if (ctx.isPremium) return false;
  if (ADS_CONFIG.skipFirstSession && ctx.sessions < 2) return false;
  if (ctx.gameSec < ADS_CONFIG.interstitialMinGameSec) return false;

  const requiredGames = ctx.userWon
    ? ADS_CONFIG.interstitialMinGames
    : Math.max(
        ADS_CONFIG.interstitialMinGames,
        ADS_CONFIG.interstitialMinGamesAfterLoss
      );
  if (state.gamesFinished < requiredGames) return false;
  if (state.shownToday >= ADS_CONFIG.interstitialMaxPerDay) return false;

  const trigger = ctx.trigger ?? 'close_match';
  if (!ctx.userWon) {
    // Tilt protection: after two losses in a row, stay completely quiet.
    if (state.consecutiveLosses > ADS_CONFIG.maxConsecutiveLossesForAd) return false;
    // Leaving after a loss is the worst possible moment for an ad.
    if (trigger === 'close_match') return false;
    // A post-loss ad is only acceptable when the player is already choosing
    // to invest in another real match.
    if (ctx.gameSec < 45) return false;
  }

  if (
    state.lastRewardedAtMs != null &&
    state.now - state.lastRewardedAtMs <
      ADS_CONFIG.interstitialRewardedShieldSec * 1000
  ) {
    return false;
  }

  const minGapMs =
    (ctx.userWon
      ? ADS_CONFIG.interstitialWinGapSec
      : ADS_CONFIG.interstitialNeutralGapSec) * 1000;
  if (
    state.lastShownAtMs != null &&
    state.now - state.lastShownAtMs < minGapMs
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

async function writeNum(key: string, value: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Count hygiene must never break the flow.
  }
}

async function readString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Records a completed match exactly once. Called when the board reaches
 * COMPLETED — before the player touches a button. Short aborts neither count
 * nor break a loss streak.
 */
export async function recordGameFinished(
  outcome: GameFinishedOutcome
): Promise<void> {
  try {
    if (outcome.gameId) {
      const lastGameId = await readString(LAST_GAME_KEY);
      if (lastGameId === outcome.gameId) return;
      try {
        await AsyncStorage.setItem(LAST_GAME_KEY, outcome.gameId);
      } catch {
        // Dedupe is best-effort; the flow continues.
      }
    }
    if (outcome.gameSec < ADS_CONFIG.interstitialMinGameSec) return;

    const gamesFinished = (await readNum(GAMES_KEY)) + 1;
    const consecutiveLosses = outcome.userWon
      ? 0
      : (await readNum(LOSSES_KEY)) + 1;
    await writeNum(GAMES_KEY, gamesFinished);
    await writeNum(LOSSES_KEY, consecutiveLosses);
  } catch {
    // Recording is advisory; an ad decision must never crash a result screen.
  }
}

export interface InterstitialDeps {
  showAd?: () => Promise<boolean>;
}

/**
 * Reads the pacing state and shows when every rule passes. Resolves false on
 * any suppression or SDK failure — callers fire-and-forget. Game recording is
 * separate (recordGameFinished) so exit-time and completion-time never
 * double-count.
 */
export async function showInterstitialIfDue(
  ctx: InterstitialContext,
  deps: InterstitialDeps = {}
): Promise<boolean> {
  try {
    const now = Date.now();
    const gamesFinished = await readNum(GAMES_KEY);
    const state: InterstitialState = {
      gamesFinished,
      consecutiveLosses: await readNum(LOSSES_KEY),
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
