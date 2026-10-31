import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPremiumActive, usePremium } from './premium';

/**
 * Per-game analysis access.
 *
 * Analysis is 100% free for all players (does not need a subscription or rewarded ad).
 */

export type AnalysisAccess = 'premium' | 'unlocked' | 'locked';
export type AnalysisAccessState = AnalysisAccess | 'checking';

/**
 * Press-handler verdict: like AnalysisAccess, plus 'daily' when this tap
 * consumed the free daily analysis. Callers treat 'daily' as unlocked.
 */
export type AnalysisEntry = 'premium' | 'unlocked' | 'daily' | 'locked';

const UNLOCK_PREFIX = '@duoorb:rewarded-analysis:v1:';
const UNLOCK_TTL_MS = 30 * 24 * 3600 * 1000;

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

/** Pure decision table: premium > unlocked per-game > locked. */
export function resolveAccess(premiumActive: boolean, unlocked: boolean = false): AnalysisAccess {
  if (premiumActive) return 'premium';
  if (unlocked) return 'unlocked';
  return 'locked';
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
  const unlocked = await isAnalysisUnlocked(gameId, historyLength);
  if (unlocked) return 'unlocked';
  const claimedDaily = await consumeFreeAnalysis();
  if (claimedDaily) {
    await markAnalysisUnlocked(gameId, historyLength);
    return 'daily';
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
  gameId?: string,
  historyLength?: number
): Promise<AnalysisEntry> {
  const gId = gameId ?? 'unknown-game';
  const hLen = historyLength ?? 0;
  const run = entryChain.then(() => entryInner(premiumActive, gId, hLen));
  entryChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function isAnalysisUnlocked(
  gameId?: string,
  historyLength?: number
): Promise<boolean> {
  if (!gameId) return false;
  try {
    const key = unlockKey(gameId, historyLength ?? 0);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { u?: number; t?: number };
    if (parsed.u !== 1) return false;
    if (typeof parsed.t === 'number' && Date.now() - parsed.t > UNLOCK_TTL_MS) {
      void AsyncStorage.removeItem(key).catch(() => {});
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
    // Non-fatal
  }
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
 * Live access for one finished game.
 */
export function useAnalysisAccess(
  gameId: string | null,
  historyLength: number
): { access: AnalysisAccessState; recheck: () => Promise<void> } {
  const premium = usePremium();
  const [access, setAccess] = useState<AnalysisAccessState>('checking');

  const compute = useCallback(async (): Promise<AnalysisAccess> => {
    if (isPremiumActive(premium)) return 'premium';
    if (!gameId) return 'locked';
    const unlocked = await isAnalysisUnlocked(gameId, historyLength);
    return resolveAccess(false, unlocked);
  }, [premium, gameId, historyLength]);

  const recheck = useCallback(async () => {
    setAccess(await compute());
  }, [compute]);

  useEffect(() => {
    let cancelled = false;
    void compute().then((res) => {
      if (!cancelled) setAccess(res);
    });
    return () => {
      cancelled = true;
    };
  }, [compute]);

  return { access, recheck };
}
