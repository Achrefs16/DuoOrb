import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isAnalysisDevBypass,
  isAnalysisUnlocked,
  markAnalysisUnlocked,
  pruneAnalysisUnlocks,
  resolveAccess,
  unlockKey,
} from './analysisAccess';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) =>
      ks.map((k) => [k, store.has(k) ? store.get(k)! : null]),
    multiRemove: async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    },
  },
}));

vi.mock('../network/apiClient', () => ({
  api: { getMe: async () => ({}) },
}));

/**
 * Per-game analysis unlocks (MONETIZATION.md P3.1): one ad view = one game,
 * rematches re-gate, stale entries prune (E13/E24).
 */
describe('analysis unlocks', () => {
  beforeEach(() => {
    store.clear();
  });

  it('locks by default, unlocks after marking', async () => {
    expect(await isAnalysisUnlocked('g1', 40)).toBe(false);
    await markAnalysisUnlocked('g1', 40);
    expect(await isAnalysisUnlocked('g1', 40)).toBe(true);
  });

  it('scopes the unlock to the exact game + history length (E13)', async () => {
    await markAnalysisUnlocked('g1', 40);
    expect(await isAnalysisUnlocked('g1', 41)).toBe(false);
    expect(await isAnalysisUnlocked('g2', 40)).toBe(false);
    expect(unlockKey('g1', 40)).not.toBe(unlockKey('g1', 41));
  });

  it('prunes entries older than 30 days (E24)', async () => {
    await markAnalysisUnlocked('old', 10);
    store.set(
      [...store.keys()].find((k) => k.includes('old'))!,
      JSON.stringify({ u: 1, t: Date.now() - 31 * 24 * 3600 * 1000 })
    );
    await markAnalysisUnlocked('fresh', 10);
    await pruneAnalysisUnlocks();
    expect(await isAnalysisUnlocked('old', 10)).toBe(false);
    expect(await isAnalysisUnlocked('fresh', 10)).toBe(true);
  });

  it('resolves the premium > unlocked > locked priority', () => {
    expect(resolveAccess(true, false)).toBe('premium');
    expect(resolveAccess(true, true)).toBe('premium');
    expect(resolveAccess(false, true)).toBe('unlocked');
    expect(resolveAccess(false, false)).toBe('locked');
  });

  it('dev bypass is off outside dev builds (release gate untouched)', () => {
    // Vitest never defines the RN __DEV__ global, which is exactly the
    // release-like condition: no bypass, the ad/premium gate applies.
    expect(isAnalysisDevBypass()).toBe(false);
  });
});
