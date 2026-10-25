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

/** Analysis is free and unlimited for all players. */
export const FREE_ANALYSES_PER_DAY = Infinity;
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

/** Pure decision table: Analysis is free for all; premium players retain 'premium' status. */
export function resolveAccess(premiumActive: boolean, _unlocked: boolean = true): AnalysisAccess {
  if (premiumActive) return 'premium';
  return 'unlocked';
}

export async function getFreeAnalysesUsedToday(): Promise<number> {
  return 0;
}

/**
 * Consumes one free analysis. Free analysis is unlimited, so this always succeeds.
 */
export async function consumeFreeAnalysis(): Promise<boolean> {
  return true;
}

/**
 * One entry point for every Analyze tap (game-over modal, bare-replay
 * upgrade, history/profile direct analyse). Analysis is free for all players.
 */
export async function requestAnalysisEntry(
  premiumActive: boolean,
  _gameId?: string,
  _historyLength?: number
): Promise<AnalysisEntry> {
  if (premiumActive) return 'premium';
  return 'unlocked';
}

export async function isAnalysisUnlocked(
  _gameId?: string,
  _historyLength?: number
): Promise<boolean> {
  return true;
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
    // Non-fatal since analysis is free
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
 * Live access for one finished game. Free for all players.
 */
export function useAnalysisAccess(
  _gameId: string | null,
  _historyLength: number
): { access: AnalysisAccessState; recheck: () => Promise<void> } {
  const premium = usePremium();
  const [access, setAccess] = useState<AnalysisAccessState>(() =>
    isPremiumActive(premium) ? 'premium' : 'unlocked'
  );

  const compute = useCallback(async (): Promise<AnalysisAccess> => {
    return isPremiumActive(premium) ? 'premium' : 'unlocked';
  }, [premium]);

  const recheck = useCallback(async () => {
    setAccess(await compute());
  }, [compute]);

  useEffect(() => {
    setAccess(isPremiumActive(premium) ? 'premium' : 'unlocked');
  }, [premium]);

  return { access, recheck };
}
