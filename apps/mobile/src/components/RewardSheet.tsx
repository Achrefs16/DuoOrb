import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';

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

function errorCopy(error: string): string {
  switch (error) {
    case 'unavailable':
      return "Ads aren't available right now — check your connection and try again.";
    case 'store':
      return "Couldn't save the unlock — please try again.";
    case 'dismissed':
    default:
      return 'No problem — the analysis stays locked for this game.';
  }
}

export const RewardSheet: React.FC<RewardSheetProps> = ({
  visible,
  busy,
  error,
  onWatch,
  onPremium,
  onClose,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Feather name="lock" size={18} color={THEME.colors.primary} />
          <Text style={styles.title}>Unlock full analysis</Text>
        </View>
        <Text style={styles.copy}>
          Watch a short video to unlock the full engine review for this game —
          best moves, mistakes, and the win graph.
        </Text>
        <TouchableOpacity
          style={[styles.watchButton, busy && styles.watchButtonBusy]}
          onPress={onWatch}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Watch ad to unlock analysis"
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="play" size={16} color="#FFFFFF" />
              <Text style={styles.watchText}>Watch ad</Text>
            </>
          )}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{errorCopy(error)}</Text>}
        <TouchableOpacity onPress={onPremium} disabled={busy} accessibilityRole="button">
          <Text style={[styles.premium, busy && styles.laterBusy]}>
            Go Premium — unlimited, no ads
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} disabled={busy} accessibilityRole="button">
          <Text style={[styles.later, busy && styles.laterBusy]}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
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
    color: '#DC2626',
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
