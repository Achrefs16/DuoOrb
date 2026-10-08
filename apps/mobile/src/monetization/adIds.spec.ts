import { describe, expect, it } from 'vitest';
import { ADMOB_APP_ID, adUnitId, selectAdUnitId } from './adIds';

/**
 * Ad unit selection (MONETIZATION.md P6): demo units in dev (zero
 * invalid-traffic risk), real DuoOrb units in production.
 */
describe('ad unit ids', () => {
  it('uses demo units in dev', () => {
    expect(selectAdUnitId('banner', true)).toContain('3940256099942544');
    expect(selectAdUnitId('rewarded', true)).toContain('3940256099942544');
    expect(selectAdUnitId('interstitial', true)).toContain('3940256099942544');
  });

  it('uses the real DuoOrb units in production', () => {
    expect(selectAdUnitId('banner', false)).toBe(
      'ca-app-pub-6057010656402010/8570242197'
    );
    expect(selectAdUnitId('rewarded', false)).toBe(
      'ca-app-pub-6057010656402010/6459084176'
    );
    expect(selectAdUnitId('interstitial', false)).toBe(
      'ca-app-pub-6057010656402010/9282446220'
    );
  });

  it('pins the registered AdMob app id', () => {
    expect(ADMOB_APP_ID).toBe('ca-app-pub-6057010656402010~3789437235');
    expect(adUnitId('banner').length).toBeGreaterThan(0);
  });
});
