import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  shouldShowInterstitial,
  showInterstitialIfDue,
} from './interstitial';

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

const NOW = new Date(2026, 5, 15, 20, 0, 0).getTime();

function eligible(overrides = {}) {
  return {
    isPremium: false,
    sessions: 5,
    userWon: true,
    gameSec: 120,
    gamesFinished: 5,
    shownToday: 0,
    lastShownAtMs: null,
    lastRewardedAtMs: null,
    now: NOW,
    ...overrides,
  };
}

/**
 * Win-only interstitial rules (MONETIZATION.md P6): losses never show,
 * premium/first-session/short games/caps/gaps/recency all suppress.
 */
describe('interstitial rules', () => {
  beforeEach(() => {
    store.clear();
  });

  it('shows after a win with every rule satisfied', () => {
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible()
      )
    ).toBe(true);
  });

  it('never shows after a loss', () => {
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: false, gameSec: 300 },
        eligible({ userWon: false })
      )
    ).toBe(false);
  });

  it('suppresses premium, first session, short games, few games', () => {
    expect(
      shouldShowInterstitial(
        { isPremium: true, sessions: 5, userWon: true, gameSec: 120 },
        eligible()
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 1, userWon: true, gameSec: 120 },
        eligible()
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 30 },
        eligible()
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ gamesFinished: 1 })
      )
    ).toBe(false);
  });

  it('enforces the daily cap and the gap window', () => {
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ shownToday: 3 })
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ lastShownAtMs: NOW - 60_000 })
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ lastShownAtMs: NOW - 200_000 })
      )
    ).toBe(true);
  });

  it('stands down after a recent rewarded view (never two ads in a row)', () => {
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ lastRewardedAtMs: NOW - 60_000 })
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        { isPremium: false, sessions: 5, userWon: true, gameSec: 120 },
        eligible({ lastRewardedAtMs: NOW - 200_000 })
      )
    ).toBe(true);
  });

  it('counts the finished game and the shown day on success only', async () => {
    const showAd = vi.fn(async () => true);
    const ctx = { isPremium: false, sessions: 5, userWon: true, gameSec: 120 };
    // First finished game: counter hits 1 < minGames(2) -> suppressed.
    expect(await showInterstitialIfDue(ctx, { showAd })).toBe(false);
    expect(showAd).not.toHaveBeenCalled();
    // Second: eligible -> shows, day count + last written.
    expect(await showInterstitialIfDue(ctx, { showAd })).toBe(true);
    expect(showAd).toHaveBeenCalledTimes(1);
    const dayKeys = [...store.keys()].filter((k) =>
      k.includes('interstitial-day')
    );
    expect(dayKeys.length).toBe(1);
    expect(store.get(dayKeys[0])).toBe('1');
  });

  it('a failed show writes nothing', async () => {
    const showAd = vi.fn(async () => false);
    const ctx = { isPremium: false, sessions: 5, userWon: true, gameSec: 120 };
    await showInterstitialIfDue(ctx, { showAd });
    await showInterstitialIfDue(ctx, { showAd });
    expect(showAd).toHaveBeenCalledTimes(1);
    expect([...store.keys()].some((k) => k.includes('interstitial-day'))).toBe(
      false
    );
  });
});
