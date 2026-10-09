import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';

/**
 * Rewarded-analysis gate sheet (MONETIZATION.md P3.2).
 *
 * Opens from the GameOverModal Analyze row when the viewer is neither premium
 * nor already unlocked for this game: one rewarded view unlocks this game's
 * full analysis. The "Go Premium" upsell row lands here with P7's
 * PremiumSheet — deliberately omitted until then (no dead buttons).
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
}

export const RewardSheet: React.FC<RewardSheetProps> = ({
  visible,
  busy,
  error,
  onWatch,
  onPremium,
  onClose,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();

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

  return (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Feather name="lock" size={18} color={THEME.colors.primary} />
          <Text style={styles.title}>{t('reward.title')}</Text>
        </View>
        <Text style={styles.copy}>
          {t('reward.copy')}
        </Text>
        <TouchableOpacity
          style={[styles.watchButton, busy && styles.watchButtonBusy]}
          onPress={onWatch}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('reward.watchA11y')}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="play" size={16} color="#FFFFFF" />
              <Text style={styles.watchText}>{t('reward.watch')}</Text>
            </>
          )}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{getErrorCopy(error)}</Text>}
        {Platform.OS !== 'web' && (
          <TouchableOpacity onPress={onPremium} disabled={busy} accessibilityRole="button">
            <Text style={[styles.premium, busy && styles.laterBusy]}>
              {t('reward.goPremium')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onClose} disabled={busy} accessibilityRole="button">
          <Text style={[styles.later, busy && styles.laterBusy]}>{t('reward.notNow')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.textSecondary,
    marginBottom: 16,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 4,
  },
  watchButtonBusy: {
    opacity: 0.75,
  },
  watchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    fontSize: 13,
    color: THEME.colors.danger,
    marginTop: 8,
    textAlign: 'center',
  },
  later: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  premium: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.primary,
    textAlign: 'center',
    marginTop: 8,
    paddingVertical: 6,
  },
  laterBusy: {
    opacity: 0.4,
  },
});
