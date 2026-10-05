import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isPremiumActive, usePremium } from '../monetization/premium';
import { ensureSessionRecorded, shouldShowBanner } from '../monetization/realAds';
import { getBannerLib } from '../monetization/adsNative';
import { adUnitId } from '../monetization/adIds';

/**
 * Reserved banner slot (MONETIZATION.md P6, O1–O3 revised).
 *
 * Layout contract (policy-critical):
 * - The slot renders BELOW all interactive content on every surface, so a
 *   late fill or a failure-collapse can never move a button under a thumb.
 * - Free users past session one get a FIXED-height reserve (minHeight 56):
 *   the space exists before the creative arrives, so buttons never shift.
 * - Premium / first session / SDK missing / load failure → null (no space,
 *   decided before layout — nothing to shift).
 */

interface AdBannerProps {
  /** Surface identity (analytics + future per-placement tuning). */
  placement: 'home' | 'list' | 'modal';
}

export const AdBanner: React.FC<AdBannerProps> = ({ placement }) => {
  const premium = usePremium();
  const [sessions, setSessions] = useState(0);
  const [failed, setFailed] = useState(false);
  // Platform-boundary handle (web resolves the .web.ts stub → null, so this
  // file never touches the native SDK and Metro never bundles it for web).
  const [lib] = useState(getBannerLib);

  useEffect(() => {
    let on = true;
    void ensureSessionRecorded().then((n) => {
      if (on) setSessions(n);
    });
    return () => {
      on = false;
    };
  }, []);

  const show = shouldShowBanner({
    isPremium: isPremiumActive(premium),
    sessions,
    loadFailed: failed,
  });
  if (!show || !lib) return null;

  const { BannerAd, BannerAdSize } = lib;
  return (
    <View
      style={styles.slot}
      accessibilityLabel={`Advertisement (${placement})`}
    >
      <BannerAd
        unitId={adUnitId('banner')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
};

const RESERVE_HEIGHT = 56;

const styles = StyleSheet.create({
  slot: {
    minHeight: RESERVE_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
