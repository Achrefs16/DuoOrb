import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OrbIcon } from './OrbIcon';
import { PremiumBadge } from './PremiumBadge';
import { BotAvatar } from './BotAvatar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { sheetSlideStyle, useSheetSlide } from './sheetAnimation';
import { botById } from '@duoorb/game-core';

/**
 * Contextual, zero-clutter Rewarded / Premium gate sheet.
 *
 * Dedicated layouts for:
 * 1. Hint: Amber compass/lightbulb, match refill action
 * 2. Undo: Cyan rewind, match rewind action
 * 3. Bot Unlock: Real Bot Avatar, character ELO, permanent unlock
 * 4. Game Review: Tactical activity radar, full move analysis
 */

export interface RewardSheetProps {
  visible: boolean;
  /** Ad showing / reward pending. */
  busy: boolean;
  /** Machine error from showRewarded(): 'unavailable' | 'dismissed' | 'error' | 'store'. */
  error: string | null;
  onWatch: () => void;
  /** Paywall entry: unlimited access with zero ads. */
  onPremium: () => void;
  onClose: () => void;
  /** Specific variant. */
  variant?: 'analysis' | 'undo' | 'hint' | 'assist' | 'bot';
  /** Target bot name if unlocking a bot with an ad. */
  botName?: string;
  /** Target bot ID for avatar and ELO display. */
  botId?: string;
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
  botName,
  botId,
  watchLimitReached = false,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slide = useSheetSlide(visible);

  const isUndo = variant === 'undo';
  const isHint = variant === 'hint';
  const isAssist = variant === 'assist';
  const isBot = variant === 'bot';

  // Resolved bot information for the bot unlock variant
  const bot = botId ? botById(botId) : null;
  const resolvedBotName = botName || bot?.name || t('bots.defaultBotName');

  // Specific titles and subtitles
  const title = isHint
    ? t('hintSheet.title')
    : isUndo
      ? t('undoSheet.title')
      : isAssist
        ? t('reward.matchAssistsTitle')
        : isBot
          ? t('bots.unlockBotTitle', { name: resolvedBotName })
          : t('reward.title');

  const subtitle = isHint
    ? t('hintSheet.watchSub')
    : isUndo
      ? t('undoSheet.watchSub')
      : isAssist
        ? t('hintSheet.watchSub')
        : isBot
          ? bot
            ? `${bot.elo} ELO · ${bot.style || bot.title}`
            : t('bots.watchToUnlockSub', { name: resolvedBotName })
          : t('reward.watchOneReviewSub');

  const watchTitle = isHint
    ? t('hintSheet.watch')
    : isUndo
      ? t('undoSheet.watch')
      : isAssist
        ? t('hintSheet.watch')
        : isBot
          ? t('bots.watchToUnlock')
          : t('reward.watchOneReview');

  const premiumTitle = isHint || isUndo || isAssist
    ? t('reward.goPremiumAssists')
    : isBot
      ? t('reward.goPremiumBots')
      : t('reward.goPremium');

  const premiumSubtitle = isHint || isUndo || isAssist
    ? t('reward.featAssists')
    : isBot
      ? t('reward.featAllBots')
      : t('premium.bulletAnalysis');

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

            {/* Top Close Button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={busy}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.closeA11y')}
            >
              <OrbIcon name="x" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>

            {/* Contextual Hero Section */}
            <View style={styles.heroSection}>
              {isBot ? (
                bot ? (
                  <View style={styles.botAvatarContainer}>
                    <BotAvatar avatarKey={bot.avatarKey} size={68} noBg />
                    <View style={styles.botEloBadge}>
                      <Text style={styles.botEloText}>{bot.elo} ELO</Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.heroIconBadge, styles.botBadgeBg]}>
                    <OrbIcon name="cpu" size={28} color="#8B5CF6" />
                  </View>
                )
              ) : isHint || isAssist ? (
                <View style={[styles.heroIconBadge, styles.hintBadgeBg]}>
                  <OrbIcon name="lightbulb-on" size={28} color="#F59E0B" />
                </View>
              ) : isUndo ? (
                <View style={[styles.heroIconBadge, styles.undoBadgeBg]}>
                  <OrbIcon name="undo-variant" size={28} color={THEME.colors.primary} />
                </View>
              ) : (
                <View style={[styles.heroIconBadge, styles.analysisBadgeBg]}>
                  <OrbIcon name="activity" size={28} color={THEME.colors.primary} />
                </View>
              )}

              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            {/* Error Banner */}
            {error && (
              <View style={styles.errorBox}>
                <OrbIcon name="alert-circle" size={14} color={THEME.colors.danger} />
                <Text style={styles.errorText}>{getErrorCopy(error)}</Text>
              </View>
            )}

            {/* ACTION 1: Watch Ad (Primary Green Tactile Button) */}
            {!watchLimitReached ? (
              <TouchableOpacity
                style={[styles.watchBtn, busy && styles.btnBusy]}
                activeOpacity={0.85}
                onPress={onWatch}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={watchTitle}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.watchBtnContent}>
                    <View style={styles.watchPlayIcon}>
                      <OrbIcon name="play" size={13} color="#FFFFFF" />
                    </View>
                    <Text style={styles.watchBtnText} numberOfLines={1}>
                      {watchTitle}
                    </Text>
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeText}>{t('reward.free')}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.limitReachedBox}>
                <OrbIcon name="lock" size={14} color={THEME.colors.textMuted} />
                <Text style={styles.limitReachedText}>
                  Match limit reached (1/1)
                </Text>
              </View>
            )}

            {/* ACTION 2: Go Premium (Hero Value Option) */}
            <TouchableOpacity
              style={[
                styles.premiumCardBtn,
                watchLimitReached && styles.premiumPrimaryHighlight,
              ]}
              activeOpacity={0.85}
              onPress={onPremium}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={premiumTitle}
            >
              <View style={styles.premiumLeft}>
                <View
                  style={[
                    styles.premiumCrownBox,
                    watchLimitReached && styles.premiumCrownBoxHighlight,
                  ]}
                >
                  <PremiumBadge size="md" />
                </View>
                <View style={styles.premiumTextWrap}>
                  <Text
                    style={[
                      styles.premiumTitle,
                      watchLimitReached && styles.premiumTitleHighlight,
                    ]}
                    numberOfLines={1}
                  >
                    {premiumTitle}
                  </Text>
                  <Text
                    style={[
                      styles.premiumSub,
                      watchLimitReached && styles.premiumSubHighlight,
                    ]}
                    numberOfLines={1}
                  >
                    {premiumSubtitle}
                  </Text>
                </View>
              </View>
              <OrbIcon
                name="chevron-right"
                size={18}
                color={watchLimitReached ? '#FFFFFF' : THEME.colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Subtle Dismiss */}
            <TouchableOpacity
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              style={styles.notNowTouch}
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
      maxWidth: 440,
      alignSelf: 'center',
    },
    card: {
      backgroundColor: THEME.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 22,
      alignItems: 'center',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: THEME.colors.surfaceHairline,
      alignSelf: 'center',
      marginBottom: 10,
    },
    closeBtn: {
      position: 'absolute',
      top: 14,
      right: 18,
      zIndex: 10,
      padding: 6,
    },
    heroSection: {
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 20,
      paddingHorizontal: 12,
      width: '100%',
    },
    heroIconBadge: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    hintBadgeBg: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: 1.5,
      borderColor: 'rgba(245, 158, 11, 0.28)',
    },
    undoBadgeBg: {
      backgroundColor: THEME.colors.surfacePrimaryTint,
      borderWidth: 1.5,
      borderColor: THEME.colors.surfacePrimaryTintBorder,
    },
    botBadgeBg: {
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      borderWidth: 1.5,
      borderColor: 'rgba(139, 92, 246, 0.28)',
    },
    analysisBadgeBg: {
      backgroundColor: 'rgba(105, 179, 66, 0.14)',
      borderWidth: 1.5,
      borderColor: 'rgba(105, 179, 66, 0.3)',
    },
    botAvatarContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    botEloBadge: {
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      marginTop: -8,
    },
    botEloText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11,
      color: THEME.colors.textSecondary,
    },
    title: {
      fontFamily: THEME.fonts.bold,
      fontSize: 20,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      fontFamily: THEME.fonts.regular,
      fontSize: 13,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 320,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
      width: '100%',
    },
    errorText: {
      fontFamily: THEME.fonts.regular,
      fontSize: 12,
      color: THEME.colors.danger,
      flex: 1,
    },
    watchBtn: {
      width: '100%',
      height: 52,
      backgroundColor: THEME.colors.primary,
      borderBottomWidth: 3.5,
      borderBottomColor: '#4E8C2F',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    btnBusy: {
      opacity: 0.7,
    },
    watchBtnContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 16,
      width: '100%',
    },
    watchPlayIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 2,
    },
    watchBtnText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
      flexShrink: 1,
    },
    freeBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.26)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 'auto',
    },
    freeBadgeText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 10.5,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.4,
    },
    limitReachedBox: {
      width: '100%',
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
      borderRadius: 14,
      marginBottom: 10,
    },
    limitReachedText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textMuted,
    },
    premiumCardBtn: {
      width: '100%',
      height: 56,
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderWidth: 1.5,
      borderColor: THEME.colors.surfaceHairline,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.surfaceHairline,
      borderRadius: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    premiumPrimaryHighlight: {
      backgroundColor: THEME.colors.primary,
      borderWidth: 0,
      borderBottomWidth: 3.5,
      borderBottomColor: '#4E8C2F',
    },
    premiumLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    premiumCrownBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: THEME.colors.surfacePrimaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumCrownBoxHighlight: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumTitle: {
      fontFamily: THEME.fonts.bold,
      fontSize: 14,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    premiumTitleHighlight: {
      color: '#FFFFFF',
    },
    premiumSub: {
      fontFamily: THEME.fonts.medium,
      fontSize: 11.5,
      color: THEME.colors.textSecondary,
      marginTop: 2,
    },
    premiumSubHighlight: {
      color: 'rgba(255, 255, 255, 0.9)',
    },
    notNowTouch: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    notNowText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textMuted,
      textAlign: 'center',
    },
    notNowBusy: {
      opacity: 0.4,
    },
  });
