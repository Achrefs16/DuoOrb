import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  recordGameFinished,
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

const GAMES = '@duoorb:interstitial-games:v1';
const LOSSES = '@duoorb:interstitial-losses:v1';
const NOW = new Date(2026, 5, 15, 20, 0, 0).getTime();

function state(overrides = {}) {
  return {
    gamesFinished: 5,
    consecutiveLosses: 0,
    shownToday: 0,
    lastShownAtMs: null,
    lastRewardedAtMs: null,
    now: NOW,
    ...overrides,
  };
}

function ctx(overrides = {}) {
  return {
    isPremium: false,
    sessions: 5,
    userWon: true,
    gameSec: 120,
    trigger: 'new_match' as const,
    ...overrides,
  };
}

/**
 * Retention-safe pacing: positive transitions only, no rematch trigger, tilt
 * protection, rewarded shield, adaptive gaps, and a generous daily cap.
 */
describe('smart ad pacing rules', () => {
  beforeEach(() => {
    store.clear();
  });

  it('shows after the first completed win on a positive transition', () => {
    expect(shouldShowInterstitial(ctx(), state({ gamesFinished: 1 }))).toBe(true);
  });

  it('never shows for premium or short/aborted matches', () => {
    expect(shouldShowInterstitial(ctx({ isPremium: true }), state())).toBe(false);
    expect(shouldShowInterstitial(ctx({ gameSec: 19 }), state())).toBe(false);
    expect(shouldShowInterstitial(ctx({ gameSec: 20 }), state())).toBe(true);
  });

  it('suppresses post-loss ads on close and after a 2+ loss streak', () => {
    // Leaving after a loss is never monetised.
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'close_match', gameSec: 300 }),
        state({ consecutiveLosses: 1 })
      )
    ).toBe(false);
    // New Match after one long loss is allowed once two games are recorded.
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'new_match', gameSec: 120 }),
        state({ consecutiveLosses: 1, gamesFinished: 2 })
      )
    ).toBe(true);
    // Tilt: two losses in a row silence everything.
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'new_match', gameSec: 120 }),
        state({ consecutiveLosses: 2, gamesFinished: 5 })
      )
    ).toBe(false);
    // Post-loss new-match ads still require a real match (>=45s).
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'new_match', gameSec: 44 }),
        state({ consecutiveLosses: 1 })
      )
    ).toBe(false);
  });

  it('enforces the 8/day cap and adaptive cooldowns', () => {
    expect(
      shouldShowInterstitial(ctx(), state({ shownToday: 8 }))
    ).toBe(false);
    expect(
      shouldShowInterstitial(ctx(), state({ lastShownAtMs: NOW - 74_000 }))
    ).toBe(false);
    expect(
      shouldShowInterstitial(ctx(), state({ lastShownAtMs: NOW - 76_000 }))
    ).toBe(true);
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'new_match', gameSec: 120 }),
        state({ consecutiveLosses: 1, lastShownAtMs: NOW - 100_000 })
      )
    ).toBe(false);
    expect(
      shouldShowInterstitial(
        ctx({ userWon: false, trigger: 'new_match', gameSec: 120 }),
        state({ consecutiveLosses: 1, lastShownAtMs: NOW - 151_000 })
      )
    ).toBe(true);
  });

  it('grants a 3-minute shield after any completed rewarded view', () => {
    expect(
      shouldShowInterstitial(ctx(), state({ lastRewardedAtMs: NOW - 60_000 }))
    ).toBe(false);
    expect(
      shouldShowInterstitial(ctx(), state({ lastRewardedAtMs: NOW - 181_000 }))
    ).toBe(true);
  });
});

describe('completion recording', () => {
  beforeEach(() => {
    store.clear();
  });

  it('records a game once per id and is idempotent', async () => {
    await recordGameFinished({ userWon: true, gameSec: 120, gameId: 'g1' });
    await recordGameFinished({ userWon: true, gameSec: 120, gameId: 'g1' });
    expect(store.get(GAMES)).toBe('1');
    expect(store.get(LOSSES)).toBe('0');
  });

  it('does not count sub-20s aborts or break a loss streak with them', async () => {
    await recordGameFinished({ userWon: false, gameSec: 120, gameId: 'l1' });
    await recordGameFinished({ userWon: false, gameSec: 10, gameId: 'abort' });
    expect(store.get(GAMES)).toBe('1');
    expect(store.get(LOSSES)).toBe('1');
  });

  it('tracks consecutive losses and resets them on a win', async () => {
    await recordGameFinished({ userWon: false, gameSec: 120, gameId: 'l1' });
    await recordGameFinished({ userWon: false, gameSec: 120, gameId: 'l2' });
    expect(store.get(LOSSES)).toBe('2');
    await recordGameFinished({ userWon: true, gameSec: 120, gameId: 'w1' });
    expect(store.get(LOSSES)).toBe('0');
    expect(store.get(GAMES)).toBe('3');
  });

  it('shows on success only and never double-counts games at exit', async () => {
    await recordGameFinished({ userWon: true, gameSec: 120, gameId: 'g1' });
    const showAd = vi.fn(async () => true);
    expect(await showInterstitialIfDue(ctx(), { showAd })).toBe(true);
    expect(showAd).toHaveBeenCalledTimes(1);
    expect(store.get(GAMES)).toBe('1');
    const dayKeys = [...store.keys()].filter((k) =>
      k.includes('interstitial-day')
    );
    expect(dayKeys.length).toBe(1);
    expect(store.get(dayKeys[0])).toBe('1');
  });

  it('a failed show writes nothing', async () => {
    await recordGameFinished({ userWon: true, gameSec: 120, gameId: 'g1' });
    const failing = vi.fn(async () => false);
    expect(await showInterstitialIfDue(ctx(), { showAd: failing })).toBe(false);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(
      [...store.keys()].some((k) => k.includes('interstitial-day'))
    ).toBe(false);
    expect(store.has('@duoorb:interstitial-last:v1:')).toBe(false);
  });
});
