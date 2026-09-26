import React, { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GameState } from '@duoorb/game-core';
import { THEME, playerColor } from '../theme';
import { modeLabel } from '../matchModes';

interface GameOverModalProps {
  visible: boolean;
  state: GameState;
  ratingDelta?: number;
  ratingAfter?: number;
  opponentName?: string;
  isWinner?: boolean;
  /** Your seat for multiplayer placement titles (online + AI). Local games omit it. */
  myPlayerId?: string | null;
  onRematch: () => void;
  /** Only ranked quick/custom online games get a New Game action. */
  showNewGame?: boolean;
  onNewGame: () => void;
  /** Enter step-through replay on the same match screen (no navigation). */
  onReplay: () => void;
  onAnalyze: () => void;
  /** Leave the finished match. */
  onHome: () => void;
  /** Dismiss the modal and stay on the finished match screen. */
  onClose: () => void;
}

function ordinal(place: number): string {
  if (place === 1) return '1ST';
  if (place === 2) return '2ND';
  if (place === 3) return '3RD';
  return `${place}TH`;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  visible,
  state,
  ratingDelta,
  ratingAfter,
  opponentName,
  isWinner,
  myPlayerId,
  onRematch,
  showNewGame = false,
  onNewGame,
  onReplay,
  onAnalyze,
  onHome,
  onClose,
}) => {
  const winner = state.players.find((p) => p.id === state.winnerId);
  const isDraw = !state.winnerId && state.status === 'COMPLETED';
  const isMultiplayer = state.players.length > 2;
  // Complete finishing order (best first) for multiplayer result screens.
  const order = isMultiplayer
    ? [...state.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    : [];
  const myPlace = myPlayerId
    ? state.players.find((p) => p.id === myPlayerId)?.place ?? null
    : null;

  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start();
    }
  }, [visible, pop]);

  // Titles: 1v1 keeps Win/Loss; multiplayer shows placement (yours when
  // known, otherwise the winner for local pass-and-play).
  let outcomeTitle: string;
  let outcomeWin: boolean;
  if (isDraw) {
    outcomeTitle = 'DRAW';
    outcomeWin = false;
  } else if (isMultiplayer) {
    if (myPlace !== null) {
      outcomeTitle = myPlace === 1 ? 'YOU WIN' : `${ordinal(myPlace)} PLACE`;
      outcomeWin = myPlace === 1;
    } else {
      outcomeTitle = winner ? `${winner.displayName.toUpperCase()} WINS` : 'GAME OVER';
      outcomeWin = true;
    }
  } else {
    const userWon = isWinner !== undefined ? isWinner : winner?.id === 'p1';
    outcomeTitle = userWon ? 'YOU WIN' : 'DEFEAT';
    outcomeWin = !!userWon;
  }

  const subtitle = isMultiplayer
    ? `${state.players.length}-player ${modeLabel(state.mode)}`
    : opponentName
    ? `vs ${opponentName}`
    : null;

  const ratingBefore =
    ratingAfter !== undefined && ratingDelta !== undefined
      ? Math.round(ratingAfter - ratingDelta)
      : 1500;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Dismiss: stay on the finished match screen. */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close result"
          >
            <Feather name="x" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {/* Header Icon Trophy or Flag */}
          <View
            style={[
              styles.iconCircle,
              outcomeWin
                ? styles.iconCircleWin
                : isDraw
                ? styles.iconCircleDraw
                : styles.iconCircleLoss,
            ]}
          >
            <Feather
              name={outcomeWin ? 'award' : isDraw ? 'minus-circle' : 'shield'}
              size={32}
              color={
                outcomeWin
                  ? '#D97706'
                  : isDraw
                  ? THEME.colors.textSecondary
                  : THEME.colors.danger
              }
            />
          </View>

          {/* Outcome Heading */}
          <Text style={styles.outcomeTitle}>{outcomeTitle}</Text>

          {subtitle && <Text style={styles.opponentSubtitle}>{subtitle}</Text>}

          {/* Multiplayer finishing order — clean ranking list, no clocks. */}
          {isMultiplayer && order.length > 0 && (
            <View style={styles.rowsCard}>
              {order.map((p) => {
                const isMe = myPlayerId === p.id;
                const hex = playerColor(p.index, p.color);
                return (
                  <View key={p.id} style={[styles.rowLine, isMe && styles.rowLineMe]}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowPlace}>{ordinal(p.place ?? 99)}</Text>
                      <View
                        style={[
                          styles.rowAvatar,
                          {
                            backgroundColor: `${hex}1A`,
                            borderColor: `${hex}55`,
                          },
                        ]}
                      >
                        <Text style={[styles.rowAvatarLetter, { color: hex }]}>
                          {(p.displayName || 'P').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {p.displayName}
                        {isMe ? ' (You)' : ''}
                      </Text>
                    </View>
                    {(p.place ?? 99) === 1 && (
                      <Feather name="award" size={16} color="#D97706" />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Rating change (online matches only). */}
          {ratingDelta !== undefined && (
            <View style={styles.ratingSection}>
              <View style={styles.ratingDeltaBlock}>
                <Text
                  style={[
                    styles.ratingDeltaNumber,
                    { color: ratingDelta >= 0 ? THEME.colors.tertiary : THEME.colors.danger },
                  ]}
                >
                  {ratingDelta >= 0 ? `+${Math.round(ratingDelta)}` : `${Math.round(ratingDelta)}`}
                </Text>
                <Text style={styles.ratingLabel}>RATING</Text>

                {ratingAfter !== undefined && (
                  <View style={styles.ratingPill}>
                    <Text style={styles.ratingOld}>{ratingBefore}</Text>
                    <Feather name="arrow-right" size={12} color={THEME.colors.textMuted} />
                    <Text style={styles.ratingNew}>{Math.round(ratingAfter)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Winner's Loop Action Buttons */}
          <View style={styles.actionsList}>
            {/* Primary Action: Rematch */}
            <TouchableOpacity
              style={styles.rematchBtn}
              activeOpacity={0.88}
              onPress={onRematch}
            >
              <Feather name="rotate-ccw" size={16} color="#FFFFFF" />
              <Text style={styles.rematchText}>Rematch</Text>
            </TouchableOpacity>

            {/* Secondary Action: New Game (ranked quick/custom only) */}
            {showNewGame && (
              <TouchableOpacity
                style={styles.newGameBtn}
                activeOpacity={0.75}
                onPress={onNewGame}
              >
                <Feather name="play" size={16} color={THEME.colors.textPrimary} />
                <Text style={styles.newGameText}>New Game</Text>
              </TouchableOpacity>
            )}

            {/* Utility Row: Replay & Analyze */}
            <View style={styles.utilityRow}>
              <TouchableOpacity
                style={styles.utilityBtn}
                activeOpacity={0.7}
                onPress={onReplay}
              >
                <Feather name="repeat" size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.utilityText}>Replay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.utilityBtn}
                activeOpacity={0.7}
                onPress={onAnalyze}
              >
                <Feather name="activity" size={14} color={THEME.colors.primary} />
                <Text style={styles.utilityText}>Analyze</Text>
              </TouchableOpacity>
            </View>

            {/* Exit Link */}
            <TouchableOpacity
              style={styles.lobbyLink}
              activeOpacity={0.7}
              onPress={onHome}
            >
              <Text style={styles.lobbyLinkText}>Close Match</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.xl,
    padding: 24,
    maxWidth: 340,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    ...THEME.shadows.modal,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCircleWin: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  iconCircleLoss: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  iconCircleDraw: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outcomeTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.onSurface,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  opponentSubtitle: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
    fontWeight: '500',
  },
  rowsCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 12,
    gap: 2,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLineMe: {
    backgroundColor: THEME.colors.surfaceContainerLow,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rowPlace: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    width: 32,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  rowName: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    maxWidth: 150,
  },
  ratingSection: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  ratingDeltaBlock: {
    alignItems: 'center',
  },
  ratingDeltaNumber: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  ratingLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  ratingOld: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  ratingNew: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  actionsList: {
    width: '100%',
    gap: 8,
  },
  rematchBtn: {
    width: '100%',
    height: 48,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  rematchText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  newGameBtn: {
    width: '100%',
    height: 44,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  newGameText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.onSurface,
    fontSize: 14,
    fontWeight: '600',
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 2,
  },
  utilityBtn: {
    flex: 1,
    height: 38,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  utilityText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  lobbyLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 6,
  },
  lobbyLinkText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
});
