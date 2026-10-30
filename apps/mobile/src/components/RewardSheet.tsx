import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from './OrbIcon';
import { PremiumBadge } from './PremiumBadge';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { sheetSlideStyle, useSheetSlide } from './sheetAnimation';

/**
 * High-converting Rewarded / Premium gate sheet (MONETIZATION.md P3.2).
 *
 * Positions DuoOrb Premium as the hero solution (unlimited analysis, no ads),
 * with watching a rewarded video as the honest single-use free alternative.
 */

interface RewardSheetProps {
  visible: boolean;
  /** Ad showing / reward pending. */
  busy: boolean;
  /** Machine error from showRewarded(): 'unavailable' | 'dismissed' | 'error' | 'store'. */
  error: string | null;
  onWatch: () => void;
  /** Paywall entry (P7): unlimited analysis with no ads. */
  onPremium: () => void;
  onClose: () => void;
  /** Copy variant: analysis unlock (default), offline +3 Undo, unified assist, or locked bot pass. */
  variant?: 'analysis' | 'undo' | 'assist' | 'bot';
  /** Whether the user has reached the max rewarded ad limit for this match */
  watchLimitReached?: boolean;
}

export const RewardSheet: React.FC<RewardSheetProps> = ({
  visible,
  busy,
  error,
  onWatch,
  onPremium,
  onClose,
  variant = 'analysis',
  watchLimitReached = false,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slide = useSheetSlide(visible);

  const isUndo = variant === 'undo';
  const isAssist = variant === 'assist';
  const isBot = variant === 'bot';

  const title = isAssist
    ? 'Match Assists'
    : isBot
      ? 'Unlock Bot'
      : isUndo
        ? t('undoSheet.title')
        : t('reward.title');

  const headerIcon = isAssist
    ? 'help-circle'
    : isBot
      ? 'cpu'
      : isUndo
        ? 'rotate-ccw'
        : 'zap';

  const features = isAssist
    ? [
        '9 Hints & Undos in bot matches (vs 1 free)',
        '100% Ad-Free across the entire app',
        'Unlimited Match Analysis & all bots unlocked',
        'Exclusive Ball & Wall Cosmetics',
      ]
    : isBot
      ? [
        'Unlock all 39 Bots forever',
        '9 Hints & Undos in bot matches (vs 1 free)',
        '100% Ad-Free across the entire app',
        'Unlimited Match Analysis & Exclusive Cosmetics',
      ]
    : isUndo
      ? [
        '9 Hints & Undos in bot matches (vs 1 free)',
        '100% Ad-Free across the entire app',
        'Unlimited Match Analysis & all bots unlocked',
        'Exclusive Ball & Wall Cosmetics',
      ]
    : [
        '100% Ad-Free across the entire app',
        'Unlimited Match Analysis for every game',
        'Unlock all Master Bots forever',
        '9 Hints & Undos in bot matches (vs 1 free)',
        'Exclusive Ball & Wall Cosmetics',
      ];

  const premiumTitle = isAssist
    ? 'Get 9 Assists with Premium'
    : isBot
      ? 'Unlock All Bots with Premium'
      : isUndo
        ? 'Unlimited Undos with Premium'
        : t('reward.goPremium');

  const premiumSubtitle = isAssist
    ? 'No ads · 9 assists every match'
    : isBot
      ? 'No ads · All 39 bots unlocked'
      : isUndo
        ? 'No ads · 9 assists every match'
        : 'No ads · All bots, cosmetics & 9 assists';

  const watchTitle = isAssist
    ? 'Watch Video (+3 Assists)'
    : isBot
      ? 'Watch Video to Unlock'
      : isUndo
        ? t('undoSheet.watch')
        : 'Watch Video for 1 Review';

  const watchSubtitle = isAssist
    ? '3 free assists for this game'
    : isBot
      ? 'Permanently unlocks this bot'
      : isUndo
        ? '3 free undos for this game'
        : 'Unlocks this match analysis only';

  const getErrorCopy = (err: string): string => {
    switch (err) {
      case 'unavailable':
        return t('reward.errorUnavailable');
      case 'store':
        return t('reward.errorStore');
      case 'dismissed':
      default:
        return t('reward.errorDismissed');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
          <Animated.View style={[styles.card, sheetSlideStyle(slide)]}>
            {/* Grab Handle */}
            <View style={styles.handle} />

            {/* Header Row: Title & Close X */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.headerIconBadge}>
                  <OrbIcon name={headerIcon} size={18} color={THEME.colors.primary} />
                </View>
                <Text style={styles.title}>{title}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                disabled={busy}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <OrbIcon name="x" size={22} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Feature Showcase Card */}
            <View style={styles.valueCard}>
              {features.map((feature, idx) => (
                <View key={idx} style={styles.valueFeatureRow}>
                  <View style={styles.valueFeatureCheck}>
                    <OrbIcon name="check" size={12} color={THEME.colors.primary} />
                  </View>
                  <Text style={styles.valueFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBox}>
                <OrbIcon name="alert-circle" size={14} color={THEME.colors.danger} />
                <Text style={styles.errorText}>{getErrorCopy(error)}</Text>
              </View>
            )}

            {/* PRIMARY HERO ACTION: Go Premium */}
            <TouchableOpacity
              style={styles.premiumButton}
              activeOpacity={0.85}
              onPress={onPremium}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={premiumTitle}
            >
              <View style={styles.premiumButtonContent}>
                <View style={styles.premiumButtonLeft}>
                  <View style={styles.premiumCrownBadge}>
                    <PremiumBadge size="md" />
                  </View>
                  <View style={styles.premiumTextWrap}>
                    <Text style={styles.premiumButtonTitle} numberOfLines={1}>
                      {premiumTitle}
                    </Text>
                    <Text style={styles.premiumButtonSub} numberOfLines={1}>
                      {premiumSubtitle}
                    </Text>
                  </View>
                </View>
                <View style={styles.premiumCtaBox}>
                  <Text style={styles.premiumCtaText}>Subscribe</Text>
                  <OrbIcon name="chevron-right" size={14} color="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>

            {/* SECONDARY FREE ALTERNATIVE: Watch Ad (only if not limit reached) */}
            {!watchLimitReached && (
              <TouchableOpacity
                style={[styles.watchButton, busy && styles.watchButtonBusy]}
                activeOpacity={0.75}
                onPress={onWatch}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={watchTitle}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={THEME.colors.primary} />
                ) : (
                  <View style={styles.watchButtonContent}>
                    <View style={styles.watchButtonLeft}>
                      <View style={styles.watchPlayBadge}>
                        <OrbIcon name="play" size={14} color={THEME.colors.textPrimary} />
                      </View>
                      <View style={styles.watchTextWrap}>
                        <Text style={styles.watchTitle} numberOfLines={1}>
                          {watchTitle}
                        </Text>
                        <Text style={styles.watchSub} numberOfLines={1}>
                          {watchSubtitle}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.watchFreePill}>
                      <Text style={styles.watchFreePillText}>FREE</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Subtle Dismiss */}
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={[styles.notNowText, busy && styles.notNowBusy]}>
                {t('reward.notNow')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: THEME.colors.modalBackdrop,
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      justifyContent: 'flex-end',
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
    },
    card: {
      backgroundColor: THEME.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 24,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: THEME.colors.surfaceHairline,
      alignSelf: 'center',
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    headerIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: THEME.colors.surfacePrimaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: THEME.fonts.bold,
      fontSize: 18,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      flex: 1,
    },
    closeBtn: {
      padding: 4,
    },
    valueCard: {
      backgroundColor: THEME.colors.backgroundCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      padding: 14,
      marginBottom: 16,
      gap: 10,
    },
    valueFeatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    valueFeatureCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: THEME.colors.surfacePrimaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueFeatureText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textPrimary,
      flex: 1,
      lineHeight: 18,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 14,
    },
    errorText: {
      fontFamily: THEME.fonts.regular,
      fontSize: 12,
      color: THEME.colors.danger,
      flex: 1,
    },
    premiumButton: {
      backgroundColor: THEME.colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 10,
      shadowColor: THEME.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 3,
    },
    premiumButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    premiumButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    premiumCrownBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumButtonTitle: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    premiumButtonSub: {
      fontFamily: THEME.fonts.regular,
      fontSize: 11,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: 2,
    },
    premiumCtaBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      gap: 3,
      marginLeft: 8,
    },
    premiumCtaText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    watchButton: {
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderWidth: 1.5,
      borderColor: THEME.colors.surfaceHairline,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    watchLimitBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    watchLimitText: {
      fontFamily: THEME.fonts.regular,
      fontSize: 12,
      color: THEME.colors.textSecondary,
      flex: 1,
      lineHeight: 16,
    },
    watchButtonBusy: {
      opacity: 0.65,
    },
    watchButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    watchButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    watchPlayBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: THEME.colors.surfaceHairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    watchTextWrap: {
      flex: 1,
    },
    watchTitle: {
      fontFamily: THEME.fonts.semiBold,
      fontSize: 13.5,
      fontWeight: '600',
      color: THEME.colors.textPrimary,
    },
    watchSub: {
      fontFamily: THEME.fonts.regular,
      fontSize: 11,
      color: THEME.colors.textSecondary,
      marginTop: 1,
    },
    watchFreePill: {
      backgroundColor: THEME.colors.surfaceHairline,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginLeft: 6,
    },
    watchFreePillText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11,
      fontWeight: '700',
      color: THEME.colors.textSecondary,
    },
    notNowText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textMuted,
      textAlign: 'center',
      paddingVertical: 8,
    },
    notNowBusy: {
      opacity: 0.4,
    },
  });
