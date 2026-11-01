import React, { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isPremiumActive, usePremium } from '../monetization/premium';
import { ensureSessionRecorded, getCompletedGamesCount, shouldShowBanner } from '../monetization/realAds';
import { getBannerLib } from '../monetization/adsNative';
import { adUnitId } from '../monetization/adIds';
import { THEME, useStyles } from '../theme';

const DIAMOND_IMG = require('../../assets/dimand.png');

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
 * - GameOverModal uses `keepReservedSpaceOnFail={true}`: if AdMob fails or has
 *   no fill, it keeps the exact 150px height as a subtle Premium card so the
 *   vertically centered modal card never jumps downward by 75px.
 *
 * Formats:
 * - home/list: large anchored adaptive (full-width strip).
 * - modal: inline adaptive sized to the result card (taller, full card
 *   width) — eligible for richer creatives (incl. video).
 */

interface AdBannerProps {
  /** Surface identity (analytics + future per-placement tuning). */
  placement: 'home' | 'list' | 'modal' | 'lobby' | 'setup';
  /** If true, keeps the reserved height on ad load failure instead of collapsing */
  keepReservedSpaceOnFail?: boolean;
  /** Optional callback to open the Premium paywall */
  onOpenPremium?: () => void;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  placement,
  keepReservedSpaceOnFail = false,
  onOpenPremium,
}) => {
  const styles = useStyles(createStyles);
  const premium = usePremium();
  const [sessions, setSessions] = useState(0);
  const [completedGames, setCompletedGames] = useState<number | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  // Platform-boundary handle (web resolves the .web.ts stub → null, so this
  // file never touches the native SDK and Metro never bundles it for web).
  const [lib] = useState(getBannerLib);

  useEffect(() => {
    let on = true;
    void Promise.all([ensureSessionRecorded(), getCompletedGamesCount()]).then(
      ([n, games]) => {
        if (on) {
          setSessions(n);
          setCompletedGames(games);
        }
      }
    );
    return () => {
      on = false;
    };
  }, []);

  const show = shouldShowBanner({
    isPremium: isPremiumActive(premium),
    sessions,
    completedGames,
    loadFailed: failed,
    keepReservedSpaceOnFail,
  });
  if (!show || !lib) return null;

  const { BannerAd, BannerAdSize } = lib;
  if (placement === 'modal') {
    // Result card geometry (GameOverModal): maxWidth 340, padding 24/side,
    // overlay padding 20/side. The creative is clamped to the card so it can
    // never bleed past the modal edge on narrow phones.
    const screenWidth = Dimensions.get('window').width;
    const width = Math.max(200, Math.min(292, screenWidth - 88));

    if (failed && keepReservedSpaceOnFail) {
      return (
        <TouchableOpacity
          style={[styles.slot, styles.modalFallbackCard, { width, height: MODAL_RESERVE_HEIGHT }]}
          activeOpacity={onOpenPremium ? 0.8 : 1}
          onPress={onOpenPremium}
          disabled={!onOpenPremium}
          accessibilityLabel="Go Premium — Remove Ads"
        >
          <Image source={DIAMOND_IMG} style={{ width: 28, height: 28, marginBottom: 6 }} resizeMode="contain" />
          <Text style={styles.fallbackTitle}>DuoOrb Premium</Text>
          <Text style={styles.fallbackSub}>Ad-free play, unlimited analysis & all bots</Text>
        </TouchableOpacity>
      );
    }

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

  if (failed) return null;

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

const createStyles = () =>
  StyleSheet.create({
    slot: {
      minHeight: RESERVE_HEIGHT,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalFallbackCard: {
      backgroundColor: THEME.colors.surfaceContainerLow,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.colors.outlineVariant,
      paddingHorizontal: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallbackTitle: {
      fontFamily: THEME.fonts.bold,
      color: THEME.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
      textAlign: 'center',
    },
    fallbackSub: {
      fontFamily: THEME.fonts.medium,
      color: THEME.colors.textSecondary,
      fontSize: 11,
      textAlign: 'center',
    },
  });
