import { describe, expect, it, vi, beforeEach } from 'vitest';
import { __resetIdentityForTests, setIdentity } from '../network/auth';
import {
  __resetOffersForTests,
  getPremiumPlans,
  purchaseNeedsLink,
  purchasePlan,
  restorePremium,
} from './offers';
import type { PremiumPlan } from './offers';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

vi.mock('../network/apiClient', () => ({
  api: { getMe: vi.fn(async () => ({})) },
}));

const purchasesMock = vi.hoisted(() => ({
  configure: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getCustomerInfo: vi.fn(),
  invalidateCustomerInfoCache: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
}));

vi.mock('react-native-purchases', () => ({
  default: purchasesMock,
  Purchases: purchasesMock,
}));

/**
 * Premium offerings (MONETIZATION.md P7.1): static fallback with no key,
 * live RevenueCat mapping with key, guest guard before every purchase.
 */
describe('premium offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetIdentityForTests();
    __resetOffersForTests();
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  });

  it('falls back to static plans with purchases disabled and no key', async () => {
    const res = await getPremiumPlans();
    expect(res.purchaseAvailable).toBe(false);
    expect(res.plans.map((p) => p.id)).toEqual(['monthly', 'yearly']);
    expect(res.plans[0].priceLine).toContain('$3.99');
    expect(res.plans[1].priceLine).toContain('$24.99');
    expect(purchasesMock.getOfferings).not.toHaveBeenCalled();
  });

  it('maps live packages to dynamic price lines (trial + promo)', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    purchasesMock.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          {
            identifier: '$rc_monthly',
            product: {
              priceString: '$3.99',
              introPrice: {
                price: 0,
                priceString: 'Free',
                period: 'P7D',
                periodUnit: 'DAY',
                periodNumberOfUnits: 7,
                cycles: 1,
              },
            },
          },
          {
            identifier: '$rc_annual',
            product: {
              priceString: '$24.99',
              introPrice: {
                price: 19.99,
                priceString: '$19.99',
                period: 'P1Y',
                periodUnit: 'YEAR',
                periodNumberOfUnits: 1,
                cycles: 1,
              },
            },
          },
        ],
      },
      all: {},
    });
    const res = await getPremiumPlans();
    expect(res.purchaseAvailable).toBe(true);
    const monthly = res.plans.find((p) => p.id === 'monthly')!;
    const yearly = res.plans.find((p) => p.id === 'yearly')!;
    expect(monthly.trialLine).toContain('7-day free trial');
    // P0.8 promo shape renders itself: promo price first, renewal after.
    expect(yearly.priceLine).toContain('$19.99');
    expect(yearly.priceLine).toContain('$24.99');
  });

  it('refuses to configure-purchase without a package (no fake sales)', async () => {
    const plan: PremiumPlan = {
      id: 'monthly',
      title: 'Monthly',
      priceLine: '$3.99/mo',
      trialLine: null,
    };
    const res = await purchasePlan(plan);
    expect(res.status).toBe('error');
    expect(purchasesMock.purchasePackage).not.toHaveBeenCalled();
  });

  it('sends guests to link-first instead of purchasing (P2.4)', async () => {
    setIdentity({
      userId: 'guest-1',
      username: 'guest',
      displayName: 'Guest',
      accessToken: 't',
      refreshToken: null,
      isGuest: true,
    });
    expect(purchaseNeedsLink()).toBe(true);
    const plan: PremiumPlan = {
      id: 'monthly',
      title: 'Monthly',
      priceLine: '$3.99/mo',
      trialLine: null,
      rcPackage: {} as never,
    };
    expect(await purchasePlan(plan)).toEqual({ status: 'needs-link' });
    expect(await restorePremium()).toEqual({ status: 'needs-link' });
    expect(purchasesMock.purchasePackage).not.toHaveBeenCalled();
  });

  it('completes purchase when active entitlement is present immediately', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    setIdentity({
      userId: 'user-1',
      username: 'player',
      displayName: 'Player',
      accessToken: 't',
      refreshToken: null,
      isGuest: false,
    });
    purchasesMock.purchasePackage.mockResolvedValueOnce({
      customerInfo: {
        entitlements: {
          active: {
            premium: {
              expirationDate: '2026-12-31T23:59:59.000Z',
              willRenew: true,
            },
          },
        },
      },
    });
    const plan: PremiumPlan = {
      id: 'monthly',
      title: 'Monthly',
      priceLine: '$3.99/mo',
      trialLine: null,
      rcPackage: { identifier: '$rc_monthly', product: { priceString: '$3.99' } } as never,
    };
    const outcome = await purchasePlan(plan);
    expect(outcome).toEqual({ status: 'done' });
  });

  it('recovers when entitlement is delayed but store activeSubscriptions exists', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    setIdentity({
      userId: 'user-1',
      username: 'player',
      displayName: 'Player',
      accessToken: 't',
      refreshToken: null,
      isGuest: false,
    });
    purchasesMock.purchasePackage.mockResolvedValueOnce({
      customerInfo: {
        entitlements: { active: {} },
        activeSubscriptions: ['com.duoorb.monthly'],
        latestExpirationDate: '2026-12-31T23:59:59.000Z',
      },
    });
    purchasesMock.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
      activeSubscriptions: ['com.duoorb.monthly'],
    });
    const plan: PremiumPlan = {
      id: 'monthly',
      title: 'Monthly',
      priceLine: '$3.99/mo',
      trialLine: null,
      rcPackage: { identifier: '$rc_monthly', product: { priceString: '$3.99' } } as never,
    };
    const outcome = await purchasePlan(plan);
    expect(outcome).toEqual({ status: 'done' });
  });

  it('auto-recovers when product is already purchased / item already owned', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    setIdentity({
      userId: 'user-1',
      username: 'player',
      displayName: 'Player',
      accessToken: 't',
      refreshToken: null,
      isGuest: false,
    });
    purchasesMock.purchasePackage.mockRejectedValueOnce({
      code: 'PRODUCT_ALREADY_PURCHASED_ERROR',
      message: 'This product is already active for the user.',
    });
    purchasesMock.restorePurchases.mockResolvedValueOnce({
      entitlements: {
        active: {
          premium: { expirationDate: null, willRenew: true },
        },
      },
    });
    const plan: PremiumPlan = {
      id: 'monthly',
      title: 'Monthly',
      priceLine: '$3.99/mo',
      trialLine: null,
      rcPackage: { identifier: '$rc_monthly', product: { priceString: '$3.99' } } as never,
    };
    const outcome = await purchasePlan(plan);
    expect(outcome).toEqual({ status: 'done' });
  });

  it('restores successfully when store returns active entitlement', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    setIdentity({
      userId: 'user-1',
      username: 'player',
      displayName: 'Player',
      accessToken: 't',
      refreshToken: null,
      isGuest: false,
    });
    purchasesMock.restorePurchases.mockResolvedValueOnce({
      entitlements: {
        active: {
          premium: { expirationDate: '2026-12-31T23:59:59.000Z', willRenew: true },
        },
      },
    });
    const outcome = await restorePremium();
    expect(outcome).toEqual({ status: 'done' });
  });

  it('restores successfully via server fallback when webhook has already processed', async () => {
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'rc-test-key';
    setIdentity({
      userId: 'user-1',
      username: 'player',
      displayName: 'Player',
      accessToken: 't',
      refreshToken: null,
      isGuest: false,
    });
    purchasesMock.restorePurchases.mockResolvedValueOnce({
      entitlements: { active: {} },
      activeSubscriptions: [],
    });
    const { api } = await import('../network/apiClient');
    vi.mocked(api.getMe).mockResolvedValueOnce({
      isPremium: true,
      premiumExpiresAt: '2026-12-31T23:59:59.000Z',
    } as never);
    const outcome = await restorePremium();
    expect(outcome).toEqual({ status: 'done' });
  });
});
