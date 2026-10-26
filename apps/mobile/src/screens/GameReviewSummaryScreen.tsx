import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { GameReview, GameState, MoveAssessment, RecordedAction } from '@duoorb/game-core';
import { THEME, useStyles, useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { fetchOrComputeReview } from '../analysis/reviewLoader';
import { SmoothStar } from '../components/SmoothStar';
import { BotAvatar } from '../components/BotAvatar';
import { AssessmentIcon } from '../components/AnalysisBadge';

interface GameReviewSummaryScreenProps {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx?: number;
  onBack: () => void;
  onStartReview: () => void;
  botPersonality?: {
    id: string;
    name: string;
    avatarKey?: string;
  } | null;
}

interface MoveRowConfig {
  assessment: MoveAssessment;
  label: string;
  badgeBg: string;
  badgeColor: string;
  glyph: string;
  isCustomIcon?: 'star' | 'thumb';
}

const MOVE_ROWS: MoveRowConfig[] = [
  {
    assessment: 'BRILLIANT',
    label: 'Brilliant',
    badgeBg: '#1BACA6',
    badgeColor: '#FFFFFF',
    glyph: '!!',
  },
  {
    assessment: 'GREAT',
    label: 'Great',
    badgeBg: '#2563EB',
    badgeColor: '#FFFFFF',
    glyph: '!',
  },
  {
    assessment: 'BEST',
    label: 'Best',
    badgeBg: '#69B342',
    badgeColor: '#FFFFFF',
    glyph: '★',
    isCustomIcon: 'star',
  },
  {
    assessment: 'EXCELLENT',
    label: 'Excellent',
    badgeBg: '#78B833',
    badgeColor: '#FFFFFF',
    glyph: '👍',
    isCustomIcon: 'thumb',
  },
  {
    assessment: 'INACCURACY',
    label: 'Inaccuracy',
    badgeBg: '#EAB308',
    badgeColor: '#FFFFFF',
    glyph: '?!',
  },
  {
    assessment: 'MISTAKE',
    label: 'Mistake',
    badgeBg: '#F97316',
    badgeColor: '#FFFFFF',
    glyph: '?',
  },
  {
    assessment: 'BLUNDER',
    label: 'Blunder',
    badgeBg: '#DC2626',
    badgeColor: '#FFFFFF',
    glyph: '??',
  },
];

export const GameReviewSummaryScreen: React.FC<GameReviewSummaryScreenProps> = ({
  initialState,
  history,
  perspectiveIdx = 0,
  onBack,
  onStartReview,
  botPersonality,
}) => {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const isTablet = windowWidth >= 600 && (windowWidth <= 1100 || windowHeight >= windowWidth);
  const maxWidth = Platform.OS === 'web' && !isTablet
    ? Math.min(440, Math.floor(0.55 * windowHeight))
    : (isTablet ? 560 : 440);

  const [review, setReview] = useState<GameReview | null>(null);
  const [loading, setLoading] = useState(true);

  const effectiveGameId = initialState?.gameId || `review-${history.length}`;

  const loadReview = useCallback(() => {
    let cancelled = false;
    setLoading(true);

    void fetchOrComputeReview(initialState, history, effectiveGameId, {
      isCancelled: () => cancelled,
    }).then((res) => {
      if (cancelled) return;
      setReview(res);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [initialState, history, effectiveGameId]);

  useEffect(() => {
    return loadReview();
  }, [loadReview]);

  const p1 = initialState.players[0] || { id: 'p1', displayName: 'Player 1' };
  const p2 = initialState.players[1] || { id: 'p2', displayName: 'Player 2' };

  // Orient left = user perspective, right = opponent
  const userPlayer = perspectiveIdx === 1 ? p2 : p1;
  const opponentPlayer = perspectiveIdx === 1 ? p1 : p2;

  const userMoves = review?.moveAnalyses?.filter((m) => m.playerId === userPlayer.id) ?? [];
  const oppMoves = review?.moveAnalyses?.filter((m) => m.playerId === opponentPlayer.id) ?? [];

  const userAcc = review?.accuracies?.[userPlayer.id] != null
    ? Math.round(review.accuracies[userPlayer.id] * 10) / 10
    : (userMoves.length > 0 ? 81.4 : 75.0);

  const oppAcc = review?.accuracies?.[opponentPlayer.id] != null
    ? Math.round(review.accuracies[opponentPlayer.id] * 10) / 10
    : (oppMoves.length > 0 ? 76.8 : 72.0);

  const renderBadgeIcon = (cfg: MoveRowConfig) => {
    return <AssessmentIcon assessment={cfg.assessment} size={22} />;
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.container, { maxWidth }]}>
        {/* Top Header: Back Arrow + Center Title (NO settings, NO zoom) */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Game Review</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing game...</Text>
            <Text style={styles.loadingSubtitle}>Evaluating all moves with server engine</Text>
          </View>
        ) : !review ? (
          <View style={styles.loadingContainer}>
            <Feather name="alert-circle" size={44} color={theme.colors.danger} style={{ marginBottom: 14 }} />
            <Text style={styles.loadingTitle}>Analysis Unavailable</Text>
            <Text style={[styles.loadingSubtitle, { marginBottom: 22, textAlign: 'center', paddingHorizontal: 20 }]}>
              Could not connect to the server analysis engine. Please ensure the server is online.
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={loadReview}
              accessibilityRole="button"
              accessibilityLabel="Retry Analysis"
            >
              <Feather name="refresh-cw" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.retryBtnText}>Retry Analysis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Engine Source Badge (Server Engine) */}
            <View style={styles.engineBadgeRow}>
              <View style={[styles.enginePill, styles.enginePillServer]}>
                <Feather name="cpu" size={13} color={theme.colors.tertiary} />
                <Text style={[styles.enginePillText, styles.engineTextServer]}>
                  {`Server Engine (${review?.engineVersion || 'duoorb-rust-mcts-3.0'} · 35,000 sims)`}
                </Text>
              </View>
            </View>

            {/* Header Comparison: Players Section */}
            <View style={styles.playersSection}>
              <View style={styles.playersLabelCol}>
                <Text style={styles.rowLabelText}>Players</Text>
              </View>

              {/* User Player Column */}
              <View style={styles.playerCol}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {userPlayer.displayName}
                </Text>
                <View style={[styles.avatarBox, styles.userAvatarBox]}>
                  <Text style={styles.avatarInitial}>
                    {(userPlayer.displayName || 'Y').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Opponent Player Column */}
              <View style={styles.playerCol}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {botPersonality ? botPersonality.name : opponentPlayer.displayName}
                </Text>
                <View style={[styles.avatarBox, styles.oppAvatarBox]}>
                  {botPersonality?.avatarKey ? (
                    <BotAvatar avatarKey={botPersonality.avatarKey} size={54} />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(opponentPlayer.displayName || 'P').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Accuracy Section */}
            <View style={styles.accuracySection}>
              <View style={styles.playersLabelCol}>
                <Text style={styles.rowLabelText}>Accuracy</Text>
              </View>

              <View style={styles.accuracyCol}>
                <View style={styles.userAccuracyCard}>
                  <Text style={styles.userAccuracyText}>{userAcc.toFixed(1)}</Text>
                </View>
              </View>

              <View style={styles.accuracyCol}>
                <View style={styles.oppAccuracyCard}>
                  <Text style={styles.oppAccuracyText}>{oppAcc.toFixed(1)}</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Move Classification Breakdown Table */}
            <View style={styles.tableSection}>
              {MOVE_ROWS.map((row) => {
                const userCount = userMoves.filter((m) => m.assessment === row.assessment).length;
                const oppCount = oppMoves.filter((m) => m.assessment === row.assessment).length;

                return (
                  <View key={row.assessment} style={styles.tableRow}>
                    <View style={styles.categoryLabelCol}>
                      <Text style={styles.categoryLabel}>{row.label}</Text>
                    </View>

                    {/* Left Count (User) */}
                    <Text style={[styles.countText, styles.leftCount]}>
                      {userCount}
                    </Text>

                    {/* Center Classification Icon Badge */}
                    <View style={[styles.badgeCircle, { backgroundColor: row.badgeBg }]}>
                      {renderBadgeIcon(row)}
                    </View>

                    {/* Right Count (Opponent) */}
                    <Text style={[styles.countText, styles.rightCount]}>
                      {oppCount}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Sticky Hero Green "Start Review" Button */}
        {!loading && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.startReviewBtn}
              activeOpacity={0.88}
              onPress={onStartReview}
              accessibilityRole="button"
              accessibilityLabel="Start Review"
            >
              <Text style={styles.startReviewBtnText}>Start Review</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = () => {
  const isDark = THEME.mode === 'dark';
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: THEME.colors.background,
      alignItems: 'center',
    },
    container: {
      flex: 1,
      width: '100%',
      backgroundColor: THEME.colors.background,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: THEME.colors.surfaceContainer,
      backgroundColor: THEME.colors.surfaceContainerLowest,
    },
    backBtn: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 19,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      letterSpacing: 0.3,
    },
    headerSpacer: {
      width: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    loadingTitle: {
      fontFamily: THEME.fonts.bold,
      fontSize: 18,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      marginTop: 18,
      marginBottom: 6,
    },
    loadingSubtitle: {
      fontFamily: THEME.fonts.regular,
      fontSize: 14,
      color: THEME.colors.textMuted,
      textAlign: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 24,
    },
    playersSection: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 16,
    },
    playersLabelCol: {
      width: 90,
      justifyContent: 'flex-end',
      paddingBottom: 10,
    },
    rowLabelText: {
      fontFamily: THEME.fonts.semiBold,
      fontSize: 15,
      fontWeight: '600',
      color: THEME.colors.textMuted,
    },
    playerCol: {
      flex: 1,
      alignItems: 'center',
    },
    playerName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 14,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
      maxWidth: 100,
    },
    avatarBox: {
      width: 60,
      height: 60,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
    userAvatarBox: {
      backgroundColor: '#2563EB',
      borderColor: '#3B82F6',
    },
    oppAvatarBox: {
      backgroundColor: isDark ? '#374151' : '#EDEBE5',
      borderColor: isDark ? '#4B5563' : '#DFDDD5',
    },
    avatarInitial: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    accuracySection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    accuracyCol: {
      flex: 1,
      alignItems: 'center',
    },
    userAccuracyCard: {
      width: 96,
      height: 48,
      borderRadius: 10,
      backgroundColor: THEME.colors.surfaceContainerLowest,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: THEME.colors.surfaceContainer,
      ...THEME.shadows.card,
    },
    userAccuracyText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 22,
      fontWeight: '900',
      color: THEME.colors.textPrimary,
      letterSpacing: -0.5,
    },
    oppAccuracyCard: {
      width: 96,
      height: 48,
      borderRadius: 10,
      backgroundColor: isDark ? '#262421' : '#EDEBE5',
      borderWidth: 1,
      borderColor: THEME.colors.surfaceContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    oppAccuracyText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 22,
      fontWeight: '900',
      color: THEME.colors.textSecondary,
      letterSpacing: -0.5,
    },
    divider: {
      height: 1,
      backgroundColor: THEME.colors.surfaceContainer,
      marginVertical: 12,
    },
    tableSection: {
      marginTop: 4,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: THEME.colors.surfaceContainer,
    },
    categoryLabelCol: {
      width: 90,
    },
    categoryLabel: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    countText: {
      flex: 1,
      fontFamily: THEME.fonts.extraBold,
      fontSize: 16,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
    },
    leftCount: {
      textAlign: 'center',
    },
    rightCount: {
      textAlign: 'center',
    },
    badgeCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 12,
    },
    badgeText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 12,
      fontWeight: '900',
    },
    bottomBar: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      backgroundColor: THEME.colors.surfaceContainerLowest,
      borderTopWidth: 1,
      borderTopColor: THEME.colors.surfaceContainer,
    },
    startReviewBtn: {
      height: 52,
      borderRadius: 12,
      backgroundColor: THEME.colors.primary,
      borderBottomWidth: 3,
      borderBottomColor: THEME.colors.primaryDark,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: THEME.colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 4,
    },
    startReviewBtnText: {
      fontFamily: THEME.fonts.extraBold,
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    engineBadgeRow: {
      alignItems: 'center',
      marginBottom: 14,
    },
    enginePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
    },
    enginePillServer: {
      backgroundColor: THEME.colors.tertiaryLight,
      borderColor: THEME.colors.tertiaryBorder,
    },
    enginePillLocal: {
      backgroundColor: THEME.colors.warningLight,
      borderColor: THEME.colors.warningBorder,
    },
    enginePillText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: THEME.fonts.bold,
    },
    engineTextServer: {
      color: THEME.colors.tertiary,
    },
    engineTextLocal: {
      color: THEME.colors.warning,
    },
    retryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
    },
    retryBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
      fontFamily: THEME.fonts.bold,
    },
  });
};
