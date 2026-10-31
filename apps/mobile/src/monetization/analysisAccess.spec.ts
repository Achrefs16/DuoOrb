import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  FREE_ANALYSES_PER_DAY,
  consumeFreeAnalysis,
  freeDayKey,
  getFreeAnalysesUsedToday,
  isAnalysisUnlocked,
  markAnalysisUnlocked,
  pruneAnalysisUnlocks,
  requestAnalysisEntry,
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
 * Analysis access tests: Game analysis is free for all players (no subscription or ad required).
 */
describe('analysis access', () => {
  beforeEach(() => {
    store.clear();
  });

  it('reports unlocked only after game is marked unlocked', async () => {
    expect(await isAnalysisUnlocked('g1', 40)).toBe(false);
    await markAnalysisUnlocked('g1', 40);
    expect(await isAnalysisUnlocked('g1', 40)).toBe(true);
    expect(await isAnalysisUnlocked('g2', 10)).toBe(false);
  });

  it('resolves access correctly based on premium and unlocked states', () => {
    expect(resolveAccess(true, false)).toBe('premium');
    expect(resolveAccess(true, true)).toBe('premium');
    expect(resolveAccess(false, true)).toBe('unlocked');
    expect(resolveAccess(false, false)).toBe('locked');
  });

  it('enforces 1 free daily analysis, then locks subsequent games until rewarded unlock', async () => {
    // 1st review claims the free daily and unlocks that game for full review
    const first = await requestAnalysisEntry(false, 'g1', 40);
    expect(first).toBe('daily');
    expect(await getFreeAnalysesUsedToday()).toBe(1);
    expect(await isAnalysisUnlocked('g1', 40)).toBe(true);

    // 2nd review today without ad is locked
    const second = await requestAnalysisEntry(false, 'g2', 10);
    expect(second).toBe('locked');
    expect(await isAnalysisUnlocked('g2', 10)).toBe(false);

    // After watching rewarded ad for g2, g2 is unlocked
    await markAnalysisUnlocked('g2', 10);
    const retrySecond = await requestAnalysisEntry(false, 'g2', 10);
    expect(retrySecond).toBe('unlocked');
  });

  it('grants premium status for premium subscribers without using daily allowance', async () => {
    expect(await requestAnalysisEntry(true, 'g9', 10)).toBe('premium');
    expect(await getFreeAnalysesUsedToday()).toBe(0);
  });

  it('day keys roll over by local calendar date', () => {
    expect(freeDayKey(new Date(2026, 0, 5))).not.toBe(
      freeDayKey(new Date(2026, 0, 6))
    );
  });
});
