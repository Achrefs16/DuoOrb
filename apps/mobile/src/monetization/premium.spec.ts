import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetPremiumForTests,
  clearPremium,
  hydratePremiumCache,
  ingestMe,
  isPremiumActive,
  refreshPremium,
} from './premium';

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
  },
}));

const meResponse: Record<string, unknown> = {};

vi.mock('../network/apiClient', () => ({
  api: {
    getMe: async () => ({ ...meResponse }),
  },
}));

/**
 * Premium client state (MONETIZATION.md P2.3): server is truth, this module is
 * a live view with an offline cache. A cached `true` past expiry must read as
 * `false` everywhere.
 */
describe('premium state', () => {
  beforeEach(() => {
    store.clear();
    for (const k of Object.keys(meResponse)) delete meResponse[k];
    __resetPremiumForTests();
  });

  it('ingests server truth and coerces missing fields to free', () => {
    const s = ingestMe({
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(s.isPremium).toBe(true);
    expect(isPremiumActive(s)).toBe(true);
    expect(ingestMe({}).isPremium).toBe(false);
  });

  it('reads an expired cached true as inactive', () => {
    const s = ingestMe({
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(s.isPremium).toBe(true); // stored value untouched…
    expect(isPremiumActive(s)).toBe(false); // …but effective flag is false
  });

  it('treats a true without expiry as active', () => {
    expect(isPremiumActive(ingestMe({ isPremium: true }))).toBe(true);
  });

  it('hydrates the offline cache at boot', async () => {
    ingestMe({
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    __resetPremiumForTests();
    const s = await hydratePremiumCache();
    expect(s.isPremium).toBe(true);
    expect(isPremiumActive(s)).toBe(true);
  });

  it('refreshPremium folds /me into state', async () => {
    meResponse.isPremium = true;
    meResponse.premiumExpiresAt = new Date(Date.now() + 86400000).toISOString();
    const s = await refreshPremium();
    expect(s.isPremium).toBe(true);
    expect(s.loading).toBe(false);
  });

  it('clearPremium forgets memory and disk (account exit)', async () => {
    ingestMe({
      isPremium: true,
      premiumExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    clearPremium();
    // A reboot finds nothing cached: the next account starts free even
    // offline (fail-closed). No manual store.clear() — clearPremium itself
    // must have removed the key.
    __resetPremiumForTests();
    const s = await hydratePremiumCache();
    expect(s.isPremium).toBe(false);
    expect(s.loading).toBe(false);
  });
});
