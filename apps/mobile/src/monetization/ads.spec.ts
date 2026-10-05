import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetAdProviderForTests,
  MockDenyingProvider,
  MockGrantingProvider,
  setAdProvider,
  showRewarded,
} from './ads';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

/**
 * Ad provider boundary (MONETIZATION.md P3.5): fail-closed default, mock
 * injection, and a show() that always resolves (E10/E11).
 */
describe('ads provider boundary', () => {
  beforeEach(() => {
    __resetAdProviderForTests();
  });

  it('fails closed when no provider is wired', async () => {
    const res = await showRewarded('analysis');
    expect(res).toEqual({ earned: false, error: 'unavailable' });
  });

  it('resolves granted rewards from the mock provider', async () => {
    setAdProvider(MockGrantingProvider);
    expect(await showRewarded('analysis')).toEqual({ earned: true });
  });

  it('maps early-close to dismissed, never a rejection', async () => {
    setAdProvider(MockDenyingProvider);
    const res = await showRewarded('analysis');
    expect(res.earned).toBe(false);
    expect(res.error).toBe('dismissed');
  });

  it('maps a throwing provider to error, never a rejection', async () => {
    setAdProvider({
      async showRewarded() {
        throw new Error('sdk blew up');
      },
    });
    const res = await showRewarded('analysis');
    expect(res).toEqual({ earned: false, error: 'error' });
  });
});
