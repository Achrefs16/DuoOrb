import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { GameState, BotPersonality } from '@duoorb/game-core';
import type { GameEndedDto } from '@duoorb/protocol';
import { THEME, playerColor, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { PremiumBadge } from './PremiumBadge';
import { SmoothStar } from './SmoothStar';
import { AdBanner } from './AdBanner';
import { modeLabel } from '../matchModes';
import { nameInitial } from '../displayName';
import { usePremium, isPremiumActive } from '../monetization/premium';
import { analyzeMatchLocal } from '../analysis/localReview';

export interface GameOverModalProps {
  visible: boolean;
  state: GameState;
  initialState?: GameState;
  type?: 'local' | 'ai' | 'online';
  ratingDelta?: number;
  ratingAfter?: number;
  /**
   * Why the game ended (online only).
   */
  endReason?: GameEndedDto['reason'] | null;
  /** Online matches are all rated server-side; AI/local never are. */
  isRanked?: boolean;
  opponentName?: string;
  opponentIsPremium?: boolean;
  botPersonality?: BotPersonality | null;
  /** Stars earned in this AI win (1–3), or null outside AI/wins. */
  botStarsEarned?: 1 | 2 | 3 | null;
  /** Next-step tip shown under a non-perfect mastery result. */
  botStarHint?: string | null;
  isWinner?: boolean;
  /**
   * The opponent's account, when the match was against a real player.
   */
  opponentUserId?: string | null;
  onViewOpponentProfile?: () => void;
  myPlayerId?: string | null;
  seatPremium?: Record<string, boolean>;
  onRematch: () => void;
  showNewGame?: boolean;
  onNewGame: () => void;
  onReplay: () => void;
  onAnalyze: () => void;
  onHome: () => void;
  onClose: () => void;
  onOpenPremium?: () => void;
  moveCounts?: { best: number; excellent: number; good: number } | null;
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
  initialState,
  type = 'online',
  ratingDelta,
  ratingAfter,
  endReason = null,
  isRanked = false,
  opponentName,
  opponentIsPremium = false,
  botPersonality,
  botStarsEarned = null,
  botStarHint = null,
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
  onOpenPremium,
  moveCounts,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const premium = usePremium();
  const hasPremium = isPremiumActive(premium);

  const winner = state.players.find((p) => p.id === state.winnerId);
  const isDraw = !state.winnerId && state.status === 'COMPLETED';
  const isMultiplayer = state.players.length > 2;
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

  // Local move counts computation fallback (on-device only)
  const [internalCounts, setInternalCounts] = useState<{ best: number; excellent: number; good: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (moveCounts) {
      setInternalCounts(moveCounts);
      return;
    }
    if (!initialState || !state.history || state.history.length === 0) {
      setInternalCounts({ best: 0, excellent: 0, good: 0 });
      return;
    }

    let cancelled = false;
    void analyzeMatchLocal(initialState, state.history, {
      budgetMs: 15,
      isCancelled: () => cancelled,
    }).then((review) => {
      if (cancelled) return;
      const targetPlayerId = myPlayerId ?? (state.players[0]?.id || '');
      const userMoves = review.moveAnalyses.filter((m) => m.playerId === targetPlayerId);
      const best = userMoves.filter((m) => m.assessment === 'BEST').length;
      const excellent = userMoves.filter((m) => m.assessment === 'EXCELLENT').length;
      const good = userMoves.filter((m) => m.assessment === 'GOOD').length;
      setInternalCounts({ best, excellent, good });
    }).catch(() => {
      if (!cancelled) setInternalCounts({ best: 0, excellent: 0, good: 0 });
    });

    return () => {
      cancelled = true;
    };
  }, [visible, moveCounts, initialState, state.history, myPlayerId]);

  const userWon = isWinner !== undefined ? isWinner : winner?.id === (myPlayerId ?? 'p1');
  const outcomeWin = !isDraw && !!userWon;

  // Title formatting according to Chess.com
  let outcomeTitle: string;
  if (isDraw) {
    outcomeTitle = 'Draw';
  } else if (isMultiplayer) {
    outcomeTitle = myPlace === 1 ? '1st Place!' : `${ordinal(myPlace ?? 99)} Place`;
  } else if (botPersonality) {
    outcomeTitle = outcomeWin ? `You Beat ${botPersonality.name}!` : `${botPersonality.name} Won!`;
  } else {
    outcomeTitle = outcomeWin ? 'You Won!' : 'Defeat';
  }

  // Subtitle reason copy
  const lastMove = state.history[state.history.length - 1];
  const actorIsMe =
    !!myPlayerId && !!lastMove && (lastMove as { playerId?: string }).playerId === myPlayerId;
  const iWon = isMultiplayer ? myPlace === 1 : outcomeWin;

  let reasonCopy: string | null = null;
  if (endReason) {
    switch (endReason) {
      case 'GOAL_REACHED':
        reasonCopy = 'Goal Reached';
        break;
      case 'RESIGNATION':
        reasonCopy = actorIsMe ? 'Resignation' : 'Opponent Resigned';
        break;
      case 'TIMEOUT':
        reasonCopy = actorIsMe ? 'Timeout' : 'Opponent Timeout';
        break;
      case 'DISCONNECT':
        reasonCopy = iWon ? 'Opponent Disconnected' : 'Disconnected';
        break;
      case 'AFK':
        reasonCopy = 'Inactivity';
        break;
    }
  } else if (!isDraw) {
    const lastAction = lastMove?.action as { type?: string } | undefined;
    if (lastAction?.type === 'RESIGN') {
      reasonCopy = 'Resignation';
    } else {
      reasonCopy = 'Goal Reached';
    }
  }

  const subtitle = isMultiplayer
    ? `${state.players.length} Players · ${modeLabel(state.mode)}`
    : reasonCopy
    ? `by ${reasonCopy}`
    : opponentName
    ? `vs ${opponentName}`
    : null;

  const ratingBefore =
    ratingAfter !== undefined && ratingDelta !== undefined
      ? Math.round(ratingAfter - ratingDelta)
      : 1500;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Close Button on top right */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('gameover.closeResultA11y')}
          >
            <Feather name="x" size={18} color={THEME.colors.textMuted} />
          </TouchableOpacity>

          {/* Header Title & Subtitle */}
          <View style={styles.headerBlock}>
            <Text style={styles.outcomeTitle}>{outcomeTitle}</Text>
            {subtitle && (
              <Text style={styles.outcomeSubtitle}>
                {subtitle}
                {!isMultiplayer && opponentIsPremium && (
                  <Text> <PremiumBadge /></Text>
                )}
              </Text>
            )}
          </View>

          {/* Bot Mastery Stars (Vs Bot) */}
          {botPersonality && (
            <View style={styles.masterySection}>
              <View style={styles.masteryStarsRow}>
                {[1, 2, 3].map((n) => (
                  <SmoothStar
                    key={n}
                    size={28}
                    color={botStarsEarned !== null && n <= botStarsEarned ? '#D9A62E' : THEME.colors.surfaceHairline}
                  />
                ))}
              </View>
              {botStarHint && <Text style={styles.masteryHint}>{botStarHint}</Text>}
            </View>
          )}

          {/* Online Rating Delta (Online matches) */}
          {!botPersonality && !isMultiplayer && type === 'online' && (
            <View style={styles.ratingSection}>
              {ratingDelta !== undefined ? (
                <View style={styles.ratingDeltaBlock}>
                  <View style={styles.ratingClockIconCircle}>
                    <Feather name="clock" size={13} color={THEME.colors.primary} />
                  </View>
                  <Text style={styles.ratingValue}>
                    {Math.round(ratingAfter ?? ratingBefore)}
                  </Text>
                  <Text
                    style={[
                      styles.ratingDeltaPill,
                      { color: ratingDelta >= 0 ? '#69B342' : THEME.colors.danger },
                    ]}
                  >
                    {ratingDelta >= 0 ? `+${Math.round(ratingDelta)}` : `${Math.round(ratingDelta)}`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.ratingCalculating}>
                  {isRanked ? t('gameover.calculating') : t('gameover.unrated')}
                </Text>
              )}
            </View>
          )}

          {/* Multiplayer finishing order */}
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
                          { backgroundColor: `${hex}1A`, borderColor: `${hex}55` },
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
                          <Text> <PremiumBadge /></Text>
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

          {/* Move Quality Counters (Chess.com 3 Signature Badges) */}
          <View style={styles.badgesContainer}>
            <View style={styles.badgeColumn}>
              <View style={styles.badgeTopRow}>
                <View style={[styles.badgeIconCircle, { backgroundColor: '#2563EB' }]}>
                  <Text style={styles.badgeIconSymbol}>!</Text>
                </View>
                <Text style={styles.badgeCount}>
                  {internalCounts ? internalCounts.good : '—'}
                </Text>
              </View>
              <Text style={styles.badgeLabel}>Great</Text>
            </View>

            <View style={styles.badgeColumn}>
              <View style={styles.badgeTopRow}>
                <View style={[styles.badgeIconCircle, { backgroundColor: '#69B342' }]}>
                  <SmoothStar size={12} color="#FFFFFF" />
                </View>
                <Text style={styles.badgeCount}>
                  {internalCounts ? internalCounts.best : '—'}
                </Text>
              </View>
              <Text style={styles.badgeLabel}>Best</Text>
            </View>

            <View style={styles.badgeColumn}>
              <View style={styles.badgeTopRow}>
                <View style={[styles.badgeIconCircle, { backgroundColor: '#69B342' }]}>
                  <MaterialCommunityIcons name="thumb-up" size={11} color="#FFFFFF" />
                </View>
                <Text style={styles.badgeCount}>
                  {internalCounts ? internalCounts.excellent : '—'}
                </Text>
              </View>
              <Text style={styles.badgeLabel}>Excellent</Text>
            </View>
          </View>

          {/* Hero 3D Green Primary Button: Game Review */}
          <TouchableOpacity
            style={styles.gameReviewBtn}
            activeOpacity={0.88}
            onPress={onAnalyze}
          >
            <SmoothStar size={17} color="#FFFFFF" />
            <Text style={styles.gameReviewText}>Game Review</Text>
          </TouchableOpacity>

          {/* 2-Column Secondary Tactile Buttons */}
          <View style={styles.secondaryRow}>
            {type === 'ai' || botPersonality ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onNewGame}
                >
                  <MaterialCommunityIcons name="robot-outline" size={17} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>New Bot</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onRematch}
                >
                  <Feather name="rotate-ccw" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Rematch</Text>
                </TouchableOpacity>
              </>
            ) : type === 'online' ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onRematch}
                >
                  <Feather name="rotate-ccw" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Rematch</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onNewGame}
                >
                  <Feather name="play" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>New Game</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onRematch}
                >
                  <Feather name="rotate-ccw" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Rematch</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.75}
                  onPress={onHome}
                >
                  <Feather name="log-out" size={15} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Exit Match</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Opponent Profile Link */}
          {onViewOpponentProfile && opponentUserId && (
            <TouchableOpacity
              style={styles.viewProfileBtn}
              activeOpacity={0.75}
              onPress={onViewOpponentProfile}
              accessibilityRole="button"
            >
              <Feather name="user" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.viewProfileText}>{t('gameover.viewProfile')}</Text>
            </TouchableOpacity>
          )}

          {/* Ad Container & Remove Ads */}
          {!hasPremium && (
            <View style={styles.adSection}>
              <AdBanner placement="modal" />
              {onOpenPremium && (
                <TouchableOpacity
                  style={styles.removeAdsBtn}
                  activeOpacity={0.7}
                  onPress={onOpenPremium}
                >
                  <Feather name="slash" size={13} color={THEME.colors.primary} />
                  <Text style={styles.removeAdsText}>Remove Ads</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    maxWidth: 360,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    // Strictly zero shadows
    elevation: 0,
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
    zIndex: 10,
  },
  headerBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 28,
  },
  outcomeTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  outcomeSubtitle: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.onSurfaceVariant,
    marginTop: 2,
    textAlign: 'center',
  },
  masterySection: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  masteryStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  masteryHint: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 2,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingDeltaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  ratingClockIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(105, 179, 66, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.onSurface,
  },
  ratingDeltaPill: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '800',
  },
  ratingCalculating: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
  },
  rowsCard: {
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rowLineMe: {
    backgroundColor: 'rgba(105, 179, 66, 0.08)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rowPlace: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    color: THEME.colors.onSurfaceVariant,
    width: 28,
  },
  rowAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rowAvatarLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },
  rowName: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.onSurface,
    flex: 1,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
  },
  badgeColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  badgeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconSymbol: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 15,
  },
  badgeCount: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 19,
    fontWeight: '900',
    color: THEME.colors.onSurface,
  },
  badgeLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
  },
  gameReviewBtn: {
    width: '100%',
    height: 48,
    backgroundColor: THEME.colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: '#4E8C2F',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  gameReviewText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginBottom: 8,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: THEME.colors.surfaceHairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    width: '100%',
    marginBottom: 6,
  },
  viewProfileText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  adSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  removeAdsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  removeAdsText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    color: THEME.colors.primary,
  },
});
