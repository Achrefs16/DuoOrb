import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../theme';
import { modeDisplayName } from '../matchModes';
import { GameHistoryItemDto } from '../network/apiClient';

interface MatchResultModalProps {
  /** The match to show. Null keeps the modal closed. */
  match: GameHistoryItemDto | null;
  onClose: () => void;
  onReplay: (match: GameHistoryItemDto) => void;
  /**
   * Opens the shared player profile for this match's opponent. Omitted when
   * the caller has no way to reach a profile (or the opponent has no account,
   * e.g. a locally played AI game) and the action then stays hidden.
   */
  onViewOpponentProfile?: (opponent: { userId: string; username: string }) => void;
}

/**
 * Match details for a finished game. One modal, shared by History and
 * Profile → Recent Matches, so both surfaces offer the same actions and open
 * the same profile screen through the same `opponent.userId` the server
 * reported.
 */
export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  match,
  onClose,
  onReplay,
  onViewOpponentProfile,
}) => {
  // An empty userId is how a locally stored game marks "no real opponent", so
  // the action only appears for an opponent who actually has an account.
  const opponent = match?.opponent ?? null;
  const profileTarget: { userId: string; username: string } | null =
    onViewOpponentProfile && opponent?.userId
      ? { userId: opponent.userId, username: opponent.username }
      : null;

  const isWin = match?.outcome === 'WIN';
  const isDraw = match?.outcome === 'DRAW';
  const opp = opponent?.displayName || opponent?.username || 'Opponent';
  const oppRating = opponent?.ratingBefore ?? opponent?.ratingAfter;
  const delta = match?.myRating?.delta ?? 0;

  return (
    <Modal visible={!!match} transparent animationType="fade">
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.card}>
          {match && (
            <>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close match details"
              >
                <Feather name="x" size={20} color={THEME.colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.outcome}>
                {isDraw ? 'Draw' : isWin ? 'Victory' : 'Defeat'}
              </Text>
              <Text style={styles.vs}>
                vs {opp}
                {oppRating !== undefined && oppRating !== null ? ` · ${Math.round(oppRating)}` : ''}
              </Text>

              <View style={styles.rows}>
                <View style={styles.row}>
                  <Text style={styles.label}>Mode</Text>
                  <Text style={styles.value}>
                    {match.isRanked ? 'Ranked' : 'Practice'} · {modeDisplayName(match.mode)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Rating Change</Text>
                  {match.isRanked ? (
                    <Text style={[styles.value, delta >= 0 ? styles.win : styles.loss]}>
                      {delta >= 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`} Rating
                    </Text>
                  ) : (
                    <Text style={styles.value}>Unrated</Text>
                  )}
                </View>
              </View>

              <View style={styles.actions}>
                {profileTarget && (
                  <TouchableOpacity
                    style={styles.viewProfileBtn}
                    activeOpacity={0.75}
                    onPress={() => onViewOpponentProfile?.(profileTarget)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${opp}'s profile`}
                  >
                    <Feather name="user" size={14} color={THEME.colors.textSecondary} />
                    <Text style={styles.viewProfileText}>View Profile</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.replayBtn}
                  onPress={() => onReplay(match)}
                >
                  <Text style={styles.replayText}>Replay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  outcome: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.onSurface,
  },
  vs: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    fontWeight: '500',
    color: THEME.colors.onSurfaceVariant,
    marginTop: 4,
    marginBottom: 16,
  },
  rows: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  value: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  win: {
    color: THEME.colors.tertiary,
  },
  loss: {
    color: THEME.colors.secondary,
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  viewProfileBtn: {
    width: '100%',
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  viewProfileText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  replayBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLow,
    alignItems: 'center',
  },
  replayText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
  },
  doneText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onPrimary,
  },
});
