import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
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
 * - Free users past session one get a FIXED-height reserve decided before
 *   layout: the space exists before the creative arrives, so buttons never
 *   shift. The reserve matches the tallest creative the slot can serve.
 * - Premium / first session / SDK missing / load failure → null (no space,
 *   decided before layout — nothing to shift).
 *
 * Formats:
 * - home/list: large anchored adaptive (full-width strip; replaces the
 *   deprecated ANCHORED_ADAPTIVE_BANNER).
 * - modal: inline adaptive sized to the result card (taller, full card
 *   width) — eligible for richer creatives (incl. video) where AdMob has
 *   them. Still a banner: no interstitial ships (O3 revised).
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
  if (placement === 'modal') {
    // Result card geometry (GameOverModal): maxWidth 340, padding 24/side,
    // overlay padding 20/side. The creative is clamped to the card so it can
    // never bleed past the modal edge on narrow phones.
    const screenWidth = Dimensions.get('window').width;
    const width = Math.max(200, Math.min(292, screenWidth - 88));
    return (
      <View
        style={[styles.slot, { minHeight: MODAL_RESERVE_HEIGHT }]}
        accessibilityLabel="Advertisement (modal)"
      >
        <BannerAd
          unitId={adUnitId('banner')}
          size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
          width={width}
          maxHeight={MODAL_RESERVE_HEIGHT}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    );
  }
  return (
    <View
      style={styles.slot}
      accessibilityLabel={`Advertisement (${placement})`}
    >
      <BannerAd
        unitId={adUnitId('banner')}
        size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
};

const RESERVE_HEIGHT = 56;
// Tallest creative the modal slot serves: reserved up front so the result
// buttons never move when the creative lands. ~16:9 video height at the
// clamped card width, capped for small screens.
const MODAL_RESERVE_HEIGHT = 150;

const styles = StyleSheet.create({
  slot: {
    minHeight: RESERVE_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
