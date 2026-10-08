import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPremiumActive, usePremium } from './premium';

/**
 * Per-game analysis unlocks (MONETIZATION.md P3.1 / D4).
 *
 * Single analysis type, no daily cap: ONE rewarded view unlocks ONE finished
 * game. The key includes the history length, so a rematch (new game, same
 * screen) is a new gate while re-opening the same analysis is free (E13).
 * Analysis is local compute, so a client-side unlock cannot affect ranked
 * outcomes — the server never needs to meter it.
 */

export type AnalysisAccess = 'premium' | 'unlocked' | 'locked';
export type AnalysisAccessState = AnalysisAccess | 'checking';

const UNLOCK_PREFIX = '@duoorb:rewarded-analysis:v1:';
const UNLOCK_TTL_MS = 30 * 24 * 3600 * 1000; // E24: prune entries older than 30d.

export function unlockKey(gameId: string, historyLength: number): string {
  return `${UNLOCK_PREFIX}${gameId}:${historyLength}`;
}

/** Pure decision table (unit-tested); the hook below wires the inputs. */
export function resolveAccess(premiumActive: boolean, unlocked: boolean): AnalysisAccess {
  if (premiumActive) return 'premium';
  return unlocked ? 'unlocked' : 'locked';
}

/**
 * TEMP (analysis page iteration): full review opens with NO ad/premium gate
 * for everyone, every build. Flip back to false when the review UI settles —
 * release behavior (premium unlimited, free one-ad-per-game) lives behind it.
 */
export const TEMP_ANALYSIS_ALWAYS_OPEN = true;

/**
 * Dev builds skip the ad gate entirely (iteration speed on the review page):
 * access resolves 'unlocked' and press handlers jump straight to review.
 * Release behavior is untouched — premium unlimited, free one-ad-per-game.
 */
export function isAnalysisDevBypass(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
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
  const compute = useCallback(async (): Promise<AnalysisAccess> => {
    if (gameId == null) return 'locked';
    if (TEMP_ANALYSIS_ALWAYS_OPEN) return 'unlocked';
    if (isAnalysisDevBypass()) return 'unlocked';
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
