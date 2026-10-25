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

  it('is always unlocked for all games and history lengths', async () => {
    expect(await isAnalysisUnlocked('g1', 40)).toBe(true);
    expect(await isAnalysisUnlocked('g2', 10)).toBe(true);
    await markAnalysisUnlocked('g1', 40);
    expect(await isAnalysisUnlocked('g1', 40)).toBe(true);
  });

  it('resolves access to unlocked for free users and premium for subscribers', () => {
    expect(resolveAccess(true, false)).toBe('premium');
    expect(resolveAccess(true, true)).toBe('premium');
    expect(resolveAccess(false, true)).toBe('unlocked');
    expect(resolveAccess(false, false)).toBe('unlocked');
  });

  it('grants free analysis without spending quotas or locking behind ads', async () => {
    expect(FREE_ANALYSES_PER_DAY).toBe(Infinity);
    expect(await getFreeAnalysesUsedToday()).toBe(0);
    expect(await requestAnalysisEntry(false, 'g1', 40)).toBe('unlocked');
    expect(await requestAnalysisEntry(false, 'g2', 10)).toBe('unlocked');
    expect(await requestAnalysisEntry(false, 'g3', 50)).toBe('unlocked');
    expect(await consumeFreeAnalysis()).toBe(true);
  });

  it('grants premium status for premium subscribers', async () => {
    expect(await requestAnalysisEntry(true, 'g9', 10)).toBe('premium');
  });

  it('day keys roll over by local calendar date', () => {
    expect(freeDayKey(new Date(2026, 0, 5))).not.toBe(
      freeDayKey(new Date(2026, 0, 6))
    );
  });
});
