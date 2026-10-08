import React, { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { GameState, BotPersonality } from '@duoorb/game-core';
import type { GameEndedDto } from '@duoorb/protocol';
import { THEME, playerColor, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { PremiumBadge } from './PremiumBadge';
import { BotAvatar } from './BotAvatar';
import { AdBanner } from './AdBanner';
import { modeLabel } from '../matchModes';
import { nameInitial } from '../displayName';

interface GameOverModalProps {
  visible: boolean;
  state: GameState;
  ratingDelta?: number;
  ratingAfter?: number;
  /**
   * Why the game ended (online only). Rendered as a one-line meta: every
   * ending used to read identically, so a timeout win, a disconnect walkover
   * and an AFK forfeit were indistinguishable on the result screen.
   */
  endReason?: GameEndedDto['reason'] | null;
  /** Online matches are all rated server-side; AI/local never are. */
  isRanked?: boolean;
  opponentName?: string;
  /** Frozen premium flag for the named 1v1 opponent (P5.2 subtitle badge). */
  opponentIsPremium?: boolean;
  botPersonality?: BotPersonality | null;
  isWinner?: boolean;
  /**
   * The opponent's account, when the match was against a real player. Drives
   * the View Profile action; AI and local games have no opponent to open.
   */
  opponentUserId?: string | null;
  onViewOpponentProfile?: () => void;
  /** Your seat for multiplayer placement titles (online + AI). Local games omit it. */
  myPlayerId?: string | null;
  /** Premium flags by seat id for the multiplayer order rows (P5.2, frozen). */
  seatPremium?: Record<string, boolean>;
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
  endReason = null,
  isRanked = false,
  opponentName,
  opponentIsPremium = false,
  botPersonality,
  isWinner,
  opponentUserId,
  onViewOpponentProfile,
  myPlayerId,
  seatPremium,
  onRematch,
  showNewGame = false,
  onNewGame,
  onReplay,
  onAnalyze,
  onHome,
  onClose,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
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
    outcomeTitle = t('gameover.draw');
    outcomeWin = false;
  } else if (isMultiplayer) {
    if (myPlace !== null) {
      outcomeTitle = myPlace === 1 ? t('gameover.youWin') : t('gameover.place', { place: myPlace });
      outcomeWin = myPlace === 1;
    } else {
      outcomeTitle = winner ? t('gameover.playerWins', { name: winner.displayName.toUpperCase() }) : t('gameover.gameOver');
      outcomeWin = true;
    }
  } else {
    const userWon = isWinner !== undefined ? isWinner : winner?.id === 'p1';
    outcomeTitle = userWon ? t('gameover.youWin') : t('gameover.defeat');
    outcomeWin = !!userWon;
  }

  const subtitle = isMultiplayer
    ? t('gameover.multiplayerSubtitle', { count: state.players.length, mode: modeLabel(state.mode) })
    : opponentName
    ? t('gameover.vs', { name: opponentName })
    : null;

  // Ending reason, resolved against whose seat is whose: the last history
  // move names the actor for resign/timeout/AFK forfeits (the engine records
  // the forfeited seat as the move's player). Draws carry no lesson — no line.
  const lastMove = state.history[state.history.length - 1];
  const actorIsMe =
    !!myPlayerId && !!lastMove && (lastMove as { playerId?: string }).playerId === myPlayerId;
  const iWon = isMultiplayer ? myPlace === 1 : outcomeWin;
  let reasonCopy: string | null = null;
  if (!isDraw && endReason) {
    switch (endReason) {
      case 'GOAL_REACHED':
        reasonCopy = t('gameover.decidedOnBoard');
        break;
      case 'RESIGNATION':
        reasonCopy = actorIsMe ? t('gameover.youResigned') : t('gameover.opponentResigned');
        break;
      case 'TIMEOUT':
        reasonCopy = actorIsMe ? t('gameover.youTimeout') : t('gameover.opponentTimeout');
        break;
      case 'DISCONNECT':
        reasonCopy = iWon ? t('gameover.opponentDisconnect') : t('gameover.youDisconnect');
        break;
      case 'AFK':
        reasonCopy = actorIsMe ? t('gameover.youAfk') : t('gameover.opponentAfk');
        break;
    }
  }
  const metaLine = reasonCopy
    ? `${isRanked ? t('gameover.ranked') : t('gameover.unrated')} · ${reasonCopy}`
    : isRanked
    ? t('gameover.ranked')
    : t('gameover.unrated');

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
            accessibilityLabel={t('gameover.closeResultA11y')}
          >
            <Feather name="x" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {/* Header block: icon, outcome and the "vs ..." subtitle. One wrapper so the
              subtitle always clears whatever follows it — a vs-AI result has
              no rating panel or finish-order card, which used to leave it
              sitting directly on top of the Rematch button. */}
          <View style={styles.headerBlock}>
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
                    ? THEME.colors.assessmentInaccuracy
                    : isDraw
                    ? THEME.colors.textSecondary
                    : THEME.colors.danger
                }
              />
            </View>

            <Text style={styles.outcomeTitle}>{outcomeTitle}</Text>

            {subtitle && (
              <Text style={styles.opponentSubtitle}>
                {subtitle}
                {!isMultiplayer && opponentIsPremium && (
                  <Text>
                    {' '}<PremiumBadge />
                  </Text>
                )}
              </Text>
            )}

            <Text style={styles.metaLine}>{metaLine}</Text>
          </View>

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
                          {nameInitial(p.displayName)}
                        </Text>
                      </View>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {p.displayName}
                        {isMe ? ` ${t('gameover.you')}` : ''}
                        {seatPremium?.[p.id] === true && (
                          <Text>
                            {' '}<PremiumBadge />
                          </Text>
                        )}
                      </Text>
                    </View>
                    {(p.place ?? 99) === 1 && (
                      <Feather name="award" size={16} color={THEME.colors.assessmentInaccuracy} />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Rating change (online matches only). Three states, never a
              vanishing row: the delta, a calculating skeleton while the
              result is still in flight, or an explicit Unrated. */}
          {ratingDelta !== undefined ? (
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
                <Text style={styles.ratingLabel}>{t('gameover.rating')}</Text>

                {ratingAfter !== undefined && (
                  <View style={styles.ratingPill}>
                    <Text style={styles.ratingOld}>{ratingBefore}</Text>
                    <Feather name="arrow-right" size={12} color={THEME.colors.textMuted} />
                    <Text style={styles.ratingNew}>{Math.round(ratingAfter)}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : botPersonality ? (
            <View style={styles.botReactionCard}>
              <BotAvatar
                avatarKey={botPersonality.avatarKey}
                color={botPersonality.color}
                size="md"
                showGlow
              />
              <View style={styles.botReactionMeta}>
                <Text style={styles.botReactionName}>{botPersonality.name}</Text>
                <Text style={styles.botReactionQuote}>
                  "{isWinner ? botPersonality.dialogue.lose[0] : botPersonality.dialogue.win[0]}"
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingPending}>
                {isRanked ? t('gameover.calculating') : t('gameover.unrated')}
              </Text>
              {/* Same timing truth as the mid-game finish modal: the number
                  lands with the full result, never piecemeal. */}
              {isRanked && (
                <Text style={styles.ratingTiming}>
                  {t('gameover.finalRatingNote')}
                </Text>
              )}
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
              <Feather name="rotate-ccw" size={16} color={THEME.colors.onPrimary} />
              <Text style={styles.rematchText}>{t('gameover.rematch')}</Text>
            </TouchableOpacity>

            {/* Secondary Action: New Game (ranked quick/custom only) */}
            {showNewGame && (
              <TouchableOpacity
                style={styles.newGameBtn}
                activeOpacity={0.75}
                onPress={onNewGame}
              >
                <Feather name="play" size={16} color={THEME.colors.textPrimary} />
                <Text style={styles.newGameText}>{t('gameover.newGame')}</Text>
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
                <Text style={styles.utilityText}>{t('gameover.replay')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.utilityBtn}
                activeOpacity={0.7}
                onPress={onAnalyze}
              >
                <Feather name="activity" size={14} color={THEME.colors.primary} />
                <Text style={styles.utilityText}>{t('gameover.analyze')}</Text>
              </TouchableOpacity>
            </View>

            {/* Opponent identity: the one place a finished online match can
                hand the player off to the same profile screen everyone else
                uses. Hidden when there is no opponent account. */}
            {onViewOpponentProfile && opponentUserId && (
              <TouchableOpacity
                style={styles.viewProfileBtn}
                activeOpacity={0.75}
                onPress={onViewOpponentProfile}
                accessibilityRole="button"
                accessibilityLabel={`View ${opponentName ?? 'opponent'}'s profile`}
              >
                <Feather name="user" size={14} color={THEME.colors.textSecondary} />
                <Text style={styles.viewProfileText}>{t('gameover.viewProfile')}</Text>
              </TouchableOpacity>
            )}

            {/* Exit Link */}
            <TouchableOpacity
              style={styles.lobbyLink}
              activeOpacity={0.7}
              onPress={onHome}
            >
              <Text style={styles.lobbyLinkText}>{t('gameover.closeMatch')}</Text>
            </TouchableOpacity>
          </View>

          {/* Ad slot (P6, revised O3): inline adaptive banner sized to this
              card, pinned under every button — visible on every result, never
              covering or moving one. Premium / first session / no fill renders
              nothing here. */}
          <AdBanner placement="modal" />
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
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
  // Gap below the icon/outcome/subtitle group, so the content that follows
  // never touches the subtitle (AI results have no rating panel at all).
  headerBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
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
    backgroundColor: THEME.colors.warningLight,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
  },
  iconCircleLoss: {
    backgroundColor: THEME.colors.dangerLight,
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
  },
  iconCircleDraw: {
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
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
  metaLine: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 6,
    textAlign: 'center',
  },
  ratingPending: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  ratingTiming: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  rowsCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 12,
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
    // Top spacing now comes from headerBlock; keep only the gap to the
    // buttons below so the two never merge.
    marginBottom: 16,
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
    color: THEME.colors.onPrimary,
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
  viewProfileBtn: {
    width: '100%',
    height: 40,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewProfileText: {
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
  botReactionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: THEME.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  botReactionMeta: {
    flex: 1,
    gap: 2,
  },
  botReactionName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  botReactionQuote: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    color: THEME.colors.textSecondary,
  },
});
