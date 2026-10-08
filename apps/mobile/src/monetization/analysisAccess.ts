import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPremiumActive, usePremium } from './premium';

/**
 * Per-game analysis unlocks (MONETIZATION.md P3.1 / D4).
 *
 * Single analysis type. Premium is unlimited. Free players get
 * FREE_ANALYSES_PER_DAY full analyses per calendar day; further games unlock
 * with ONE rewarded view each. The per-game key includes the history length,
 * so a rematch (new game) is a new gate while re-opening the same analysis
 * is free (E13). Analysis is local compute, so a client-side unlock cannot
 * affect ranked outcomes — the server never needs to meter it.
 */

export type AnalysisAccess = 'premium' | 'unlocked' | 'locked';
export type AnalysisAccessState = AnalysisAccess | 'checking';

/**
 * Press-handler verdict: like AnalysisAccess, plus 'daily' when this tap
 * consumed the free daily analysis. Callers treat 'daily' as unlocked.
 */
export type AnalysisEntry = 'premium' | 'unlocked' | 'daily' | 'locked';

const UNLOCK_PREFIX = '@duoorb:rewarded-analysis:v1:';
const UNLOCK_TTL_MS = 30 * 24 * 3600 * 1000; // E24: prune entries older than 30d.

/** Free full analyses per calendar day for non-premium players. */
export const FREE_ANALYSES_PER_DAY = 1;
const FREE_DAY_PREFIX = '@duoorb:free-analysis-day:v1:';

export function unlockKey(gameId: string, historyLength: number): string {
  return `${UNLOCK_PREFIX}${gameId}:${historyLength}`;
}

/** Local calendar day key (YYYY-MM-DD); injectable date for tests. */
export function freeDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${FREE_DAY_PREFIX}${y}-${m}-${d}`;
}

/** Pure decision table (unit-tested); the hook below wires the inputs. */
export function resolveAccess(premiumActive: boolean, unlocked: boolean): AnalysisAccess {
  if (premiumActive) return 'premium';
  return unlocked ? 'unlocked' : 'locked';
}

export async function getFreeAnalysesUsedToday(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(freeDayKey());
    if (!raw) return 0;
    const used = (JSON.parse(raw) as { used?: number }).used;
    return typeof used === 'number' && used > 0 ? Math.floor(used) : 0;
  } catch {
    return 0;
  }
}

/**
 * Spends one free daily analysis. Returns false when today's quota is
 * spent — the caller falls through to the ad gate. Fail-closed: a store
 * error reads as "none left" (the ad path still works).
 */
export async function consumeFreeAnalysis(): Promise<boolean> {
  try {
    const key = freeDayKey();
    const raw = await AsyncStorage.getItem(key);
    const used =
      raw != null ? (JSON.parse(raw) as { used?: number }).used ?? 0 : 0;
    if (used >= FREE_ANALYSES_PER_DAY) return false;
    await AsyncStorage.setItem(key, JSON.stringify({ used: used + 1 }));
    return true;
  } catch {
    return false;
  }
}

// Press-handler serializer: peek-then-consume must not interleave across
// rapid taps, or two games could each spend the same last daily.
let entryChain: Promise<void> = Promise.resolve();

async function entryInner(
  premiumActive: boolean,
  gameId: string,
  historyLength: number
): Promise<AnalysisEntry> {
  if (premiumActive) return 'premium';
  if (await isAnalysisUnlocked(gameId, historyLength)) return 'unlocked';
  // E12 policy: write the unlock FIRST — if the store write fails we stay
  // locked and the daily is not spent.
  if ((await getFreeAnalysesUsedToday()) < FREE_ANALYSES_PER_DAY) {
    try {
      await markAnalysisUnlocked(gameId, historyLength);
    } catch {
      return 'locked';
    }
    if (await consumeFreeAnalysis()) return 'daily';
    // Lost a race we serialized against — unreachable, but fail open to
    // the game just unlocked rather than stranding the user.
    return 'unlocked';
  }
  return 'locked';
}

/**
 * One entry point for every Analyze tap (game-over modal, bare-replay
 * upgrade, history/profile direct analyse). Premium and already-unlocked
 * games pass through; otherwise the free daily is spent when available and
 * 'locked' means "show the ad gate".
 */
export function requestAnalysisEntry(
  premiumActive: boolean,
  gameId: string,
  historyLength: number
): Promise<AnalysisEntry> {
  const run = entryChain.then(() => entryInner(premiumActive, gameId, historyLength));
  entryChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function isAnalysisUnlocked(
  gameId: string,
  historyLength: number
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(unlockKey(gameId, historyLength));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { t?: number };
    if (typeof parsed.t === 'number' && Date.now() - parsed.t > UNLOCK_TTL_MS) {
      await AsyncStorage.removeItem(unlockKey(gameId, historyLength));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function markAnalysisUnlocked(
  gameId: string,
  historyLength: number
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      unlockKey(gameId, historyLength),
      JSON.stringify({ u: 1, t: Date.now() })
    );
  } catch {
    // E12 policy: if the write fails we do NOT pretend it succeeded — the
    // caller keeps the locked state and the user retries the ad.
    throw new Error('unlock-store-failed');
  }
  // Piggyback hygiene (E24): prune stale unlocks whenever we write (rare path).
  void pruneAnalysisUnlocks();
}

export async function pruneAnalysisUnlocks(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      (k) => typeof k === 'string' && k.startsWith(UNLOCK_PREFIX)
    );
    if (ours.length === 0) return;
    const pairs = await AsyncStorage.multiGet(ours);
    const now = Date.now();
    const stale = pairs
      .filter(([, v]) => {
        if (!v) return true;
        try {
          const t = (JSON.parse(v) as { t?: number }).t;
          return typeof t !== 'number' || now - t > UNLOCK_TTL_MS;
        } catch {
          return true;
        }
      })
      .map(([k]) => k);
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  } catch {
    // Hygiene must never break the unlock flow.
  }
}

/**
 * Live access for one finished game. `gameId` null (e.g. bare replays) means
 * "no gate here" — callers skip analysis entirely instead of locking.
 */
export function useAnalysisAccess(
  gameId: string | null,
  historyLength: number
): { access: AnalysisAccessState; recheck: () => Promise<void> } {
  const premium = usePremium();
  const [access, setAccess] = useState<AnalysisAccessState>(() =>
    gameId == null ? 'locked' : 'checking'
  );

  // Pure compute (no setState): safe to call from effects and handlers alike.
  // Note: the free daily is NEVER consumed here — only explicit Analyze
  // taps spend it (requestAnalysisEntry). Re-verification only reads.
  const compute = useCallback(async (): Promise<AnalysisAccess> => {
    if (gameId == null) return 'locked';
    if (isPremiumActive(premium)) return 'premium';
    return resolveAccess(false, await isAnalysisUnlocked(gameId, historyLength));
  }, [gameId, historyLength, premium]);

  const recheck = useCallback(async () => {
    setAccess(await compute());
  }, [compute]);

  useEffect(() => {
    let cancelled = false;
    void compute().then((next) => {
      if (!cancelled) setAccess(next);
    });
    return () => {
      cancelled = true;
    };
  }, [compute]);

  return { access, recheck };
}
