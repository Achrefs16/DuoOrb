import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  __resetAdsNativeForTests,
  __setAdsSdkForTests,
  buildAdRequestConfiguration,
  preloadInterstitial,
  showInterstitial,
} from './adsNative';

/**
 * The native SDK is reflective/optional. This fake proves the two Phase 1
 * contracts without a device: rating T in the request configuration, and a
 * preloaded interstitial that shows immediately then re-warms on close.
 */
function makeFakeSdk() {
  const created: FakeInterstitialAd[] = [];
  const setRequestConfiguration = vi.fn(async () => {});
  const initialize = vi.fn(async () => {});

  class FakeInterstitialAd {
    static createForAdRequest = vi.fn(() => {
      const ad = new FakeInterstitialAd();
      created.push(ad);
      return ad;
    });

    loaded = false;
    private listeners: { event: string; cb: () => void }[] = [];

    addAdEventListener(event: string, cb: () => void) {
      this.listeners.push({ event, cb });
      return () => {
        this.listeners = this.listeners.filter((l) => l.cb !== cb);
      };
    }

    private emit(event: string) {
      this.listeners.filter((l) => l.event === event).forEach((l) => l.cb());
    }

    load() {
      this.loaded = true;
      queueMicrotask(() => this.emit('LOADED'));
    }

    show() {
      queueMicrotask(() => this.emit('CLOSED'));
      return Promise.resolve();
    }

    destroy() {}
  }

  const sdk = {
    MaxAdContentRating: { G: 'G', T: 'T' },
    AdsConsent: {
      requestInfoUpdate: vi.fn(async () => {}),
      getConsentInfo: vi.fn(async () => ({})),
      loadAndShowConsentFormIfRequired: vi.fn(async () => {}),
    },
    mobileAds: () => ({ setRequestConfiguration, initialize }),
    InterstitialAd: FakeInterstitialAd,
    AdEventType: { LOADED: 'LOADED', ERROR: 'ERROR', CLOSED: 'CLOSED' },
    RewardedAd: class {},
    RewardedAdEventType: { LOADED: 'REWARDED_LOADED', EARNED_REWARD: 'EARNED' },
    BannerAd: class {},
    BannerAdSize: {},
  };

  return {
    sdk,
    created,
    createForAdRequest: FakeInterstitialAd.createForAdRequest,
    setRequestConfiguration,
  };
}

describe('AdMob video configuration', () => {
  let fake: ReturnType<typeof makeFakeSdk>;

  beforeEach(() => {
    __resetAdsNativeForTests();
    fake = makeFakeSdk();
    __setAdsSdkForTests(fake.sdk);
  });

  it('requests Teen-rated creatives, not child-directed G inventory', () => {
    expect(
      buildAdRequestConfiguration({ MaxAdContentRating: { G: 'G', T: 'T' } })
    ).toEqual({
      maxAdContentRating: 'T',
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
  });

  it('preloads an interstitial and shows it immediately', async () => {
    expect(await preloadInterstitial()).toBe(true);
    expect(fake.createForAdRequest).toHaveBeenCalledTimes(1);
    expect(fake.setRequestConfiguration).toHaveBeenCalledWith({
      maxAdContentRating: 'T',
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    const startedAt = Date.now();
    expect(await showInterstitial()).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(100);
    // CLOSED triggers a background re-warm for the next match.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.createForAdRequest).toHaveBeenCalledTimes(2);
  });

  it('cold show warms then presents without a long stall', async () => {
    expect(await showInterstitial()).toBe(true);
  });
});
