import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  GameReview,
  GameState,
  MoveAnalysis,
  RecordedAction,
  analyzeGame,
  applyAction,
  rebuildStateAtStep,
} from '@duoorb/game-core';
import { AnalysisBadge } from '../components/AnalysisBadge';
import {
  DetailsRows,
  ImpactRows,
  ShowWhy,
  SummaryBlock,
} from '../components/AnalysisPanels';
import { TryAgainPanel } from '../components/TryAgainPanel';
import { WinGraph } from '../components/WinGraph';
import { GameBoard } from '../components/GameBoard';
import { THEME, playerColor } from '../theme';
import { assessmentColor, cleanName, ordinal } from '../analysisUi';

interface GameReviewScreenProps {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx?: number;
  onBack: () => void;
}

function actionsEqual(
  a: { type: string; to?: { row: number; col: number }; wall?: { row: number; col: number; orientation: string } } | null | undefined,
  b: { type: string; to?: { row: number; col: number }; wall?: { row: number; col: number; orientation: string } } | null | undefined
): boolean {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'MOVE' && b.type === 'MOVE' && a.to && b.to) {
    return a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL' && a.wall && b.wall) {
    return (
      a.wall.row === b.wall.row &&
      a.wall.col === b.wall.col &&
      a.wall.orientation === b.wall.orientation
    );
  }
  return true;
}

export const GameReviewScreen: React.FC<GameReviewScreenProps> = ({
  initialState,
  history,
  perspectiveIdx = 0,
  onBack,
}) => {
  const review: GameReview = useMemo(() => {
    return analyzeGame(initialState, history);
  }, [initialState, history]);

  const [currentStep, setCurrentStep] = useState<number>(() => {
    const dm = review.decidingMoments[0];
    if (history.length > 0 && dm && dm.importance >= 25) {
      return Math.max(1, Math.min(history.length, dm.moveNumber));
    }
    return history.length > 0 ? 1 : 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [showWhyOpen, setShowWhyOpen] = useState(false);
  const [tryOpen, setTryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Playback timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= history.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, history.length]);

  const [flip] = useState(
    () =>
      new Animated.Value(
        initialState.mode === '2p' && perspectiveIdx === 1 ? 1 : 0
      )
  );

  const currentState = useMemo(() => {
    return rebuildStateAtStep(initialState, history, currentStep);
  }, [initialState, history, currentStep]);

  const currentAnalysis: MoveAnalysis | undefined =
    currentStep > 0 ? review.moveAnalyses[currentStep - 1] : undefined;

  /** State *before* the analyzed action — holds the mover's origin cell. */
  const preMoveState = useMemo(() => {
    return rebuildStateAtStep(initialState, history, currentStep - 1);
  }, [initialState, history, currentStep]);

  const goTo = (step: number) => {
    setCurrentStep(Math.max(0, Math.min(history.length, step)));
    setShowWhyOpen(false);
    setTryOpen(false);
  };

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 48 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -48) goTo(currentStepRef.current + 1);
        else if (g.dx > 48) goTo(currentStepRef.current - 1);
      },
    })
  ).current;

  const mover = currentAnalysis
    ? currentState.players.find((p) => p.id === currentAnalysis.playerId)
    : undefined;
  const moverColor = playerColor(mover?.index ?? 0, mover?.color);
  const moverName = cleanName(mover?.displayName);
  const threat = currentAnalysis
    ? currentState.players.find((p) => p.id === currentAnalysis.after.closestThreatId)
    : undefined;
  const markColor = currentAnalysis ? assessmentColor(currentAnalysis.assessment) : moverColor;

  const bestDiffers =
    !!currentAnalysis?.bestAction &&
    !actionsEqual(currentAnalysis.bestAction, currentAnalysis.playedAction);
  const showAlt =
    !!currentAnalysis &&
    (currentAnalysis.assessment === 'INACCURACY' ||
      currentAnalysis.assessment === 'MISTAKE' ||
      currentAnalysis.assessment === 'BLUNDER' ||
      currentAnalysis.missedWin ||
      currentAnalysis.missedDefense ||
      bestDiffers);

  const moveMark = useMemo(() => {
    if (!currentAnalysis) return null;
    const pa = currentAnalysis.playedAction;
    if (pa.type === 'MOVE') {
      const origin = preMoveState.players.find(
        (p) => p.id === currentAnalysis.playerId
      )?.position;
      return {
        from: origin,
        to: pa.to,
        color: markColor,
      };
    }
    if (pa.type === 'PLACE_WALL') {
      return {
        wall: pa.wall,
        color: markColor,
      };
    }
    return null;
  }, [currentAnalysis, markColor, preMoveState]);

  const altMark = useMemo(() => {
    if (!showAlt || !currentAnalysis?.bestAction) return null;
    const ba = currentAnalysis.bestAction;
    if (ba.type === 'MOVE') {
      return { to: ba.to, color: '#004AC6' };
    }
    if (ba.type === 'PLACE_WALL') {
      return { wall: ba.wall, color: '#004AC6' };
    }
    return null;
  }, [showAlt, currentAnalysis]);

  const opponentPlayer = currentState.players[1] || currentState.players[0];
  const userPlayer = currentState.players[0];

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Review</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Summary Pill Badge */}
        <View style={styles.summaryBadgeRow}>
          <View style={styles.resultPill}>
            <View style={styles.resultDot} />
            <Text style={styles.resultPillText}>Victory · +16</Text>
          </View>
          <Text style={styles.modeSummaryText}>Classic · 3+0</Text>
        </View>

        {/* Opponent HUD Card (Directly Above Board) */}
        {opponentPlayer && (
          <View style={styles.hudCard}>
            <View style={styles.hudLeft}>
              <View style={[styles.hudAvatar, { backgroundColor: THEME.colors.secondaryContainer }]}>
                <Text style={[styles.hudInitial, { color: THEME.colors.secondary }]}>
                  {opponentPlayer.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.hudMeta}>
                <Text style={styles.hudName}>{opponentPlayer.displayName}</Text>
                <View style={styles.hudTagRow}>
                  <Text style={styles.ratingText}>1500</Text>
                  <View style={styles.wallCountTag}>
                    <Text style={styles.wallCountText}>{opponentPlayer.wallsRemaining} walls</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.hudTimerBox}>
              <Feather name="clock" size={13} color={THEME.colors.textMuted} />
              <Text style={styles.hudTimerText}>3:00</Text>
            </View>
          </View>
        )}

        {/* Board Viewport (Our Custom GameBoard Preserved) */}
        <View {...swipe.panHandlers} style={styles.boardViewport}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: flip.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            }}
          >
            <GameBoard
              state={currentState}
              legalMoves={[]}
              previewWall={null}
              selectedCell={null}
              interactive={false}
              flipAnim={flip}
              moveMark={moveMark}
              altMark={altMark}
            />
          </Animated.View>
        </View>

        {/* User HUD Card (Directly Below Board) */}
        {userPlayer && (
          <View style={styles.hudCard}>
            <View style={styles.hudLeft}>
              <View style={[styles.hudAvatar, { backgroundColor: THEME.colors.primaryLight }]}>
                <Text style={[styles.hudInitial, { color: THEME.colors.primary }]}>
                  {userPlayer.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.hudMeta}>
                <Text style={styles.hudName}>{userPlayer.displayName} (You)</Text>
                <View style={styles.hudTagRow}>
                  <Text style={styles.ratingText}>1516</Text>
                  <View style={styles.wallCountTag}>
                    <Text style={styles.wallCountText}>{userPlayer.wallsRemaining} walls</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.hudTimerBox}>
              <Feather name="clock" size={13} color={THEME.colors.textMuted} />
              <Text style={styles.hudTimerText}>2:48</Text>
            </View>
          </View>
        )}

        {/* Replay Controls & Scrubber */}
        <View style={styles.replayControlsCard}>
          {/* Move Counter */}
          <View style={styles.moveCounterRow}>
            <Text style={styles.moveCounterText}>
              Move <Text style={styles.moveCounterHighlight}>{currentStep}</Text> / {history.length}
            </Text>
          </View>

          {/* Progress Scrubber Line */}
          <View style={styles.scrubberTrack}>
            <View
              style={[
                styles.scrubberFill,
                { width: `${history.length > 0 ? (currentStep / history.length) * 100 : 0}%` },
              ]}
            />
          </View>

          {/* Media Playback Cluster */}
          <View style={styles.mediaCluster}>
            <TouchableOpacity
              style={[styles.mediaBtn, currentStep <= 0 && styles.btnDisabled]}
              disabled={currentStep <= 0}
              onPress={() => goTo(0)}
            >
              <Feather name="chevrons-left" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaBtn, currentStep <= 0 && styles.btnDisabled]}
              disabled={currentStep <= 0}
              onPress={() => goTo(currentStep - 1)}
            >
              <Feather name="chevron-left" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <Feather name={isPlaying ? 'pause' : 'play'} size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaBtn, currentStep >= history.length && styles.btnDisabled]}
              disabled={currentStep >= history.length}
              onPress={() => goTo(currentStep + 1)}
            >
              <Feather name="chevron-right" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaBtn, currentStep >= history.length && styles.btnDisabled]}
              disabled={currentStep >= history.length}
              onPress={() => goTo(history.length)}
            >
              <Feather name="chevrons-right" size={18} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Move Strip Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moveStrip}
          >
            {Array.from({ length: history.length }, (_, i) => i + 1).map((stepNum) => {
              const isActive = currentStep === stepNum;
              const analysis = review.moveAnalyses[stepNum - 1];
              const dotColor = analysis ? assessmentColor(analysis.assessment) : THEME.colors.primary;

              return (
                <TouchableOpacity
                  key={stepNum}
                  style={[styles.moveChip, isActive && styles.moveChipActive]}
                  onPress={() => goTo(stepNum)}
                >
                  <View style={[styles.moveChipDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.moveChipText, isActive && styles.moveChipTextActive]}>
                    {stepNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Engine Analysis Panels */}
        {currentAnalysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeaderRow}>
              <AnalysisBadge assessment={currentAnalysis.assessment} />
              {showAlt && currentAnalysis.bestAction && (
                <View style={styles.bestMovePill}>
                  <Text style={styles.bestMoveText}>
                    Engine: {currentAnalysis.bestAction.type === 'MOVE' ? 'Move Orb' : 'Place Wall'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.insightText}>{currentAnalysis.explanation}</Text>

            <ImpactRows
              analysis={currentAnalysis}
              moverName={moverName}
              threatName={threat ? cleanName(threat.displayName) : null}
              multi={currentState.players.length > 2}
            />

            <View style={styles.analysisActionsRow}>
              {currentAnalysis.tryAgain && !tryOpen && (
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => {
                    setShowWhyOpen(false);
                    setTryOpen(true);
                  }}
                >
                  <Text style={styles.actionPillText}>Try again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionPillBtn}
                onPress={() => setDetailsOpen((v) => !v)}
              >
                <Text style={styles.actionPillText}>{detailsOpen ? 'Hide details' : 'Details'}</Text>
              </TouchableOpacity>
            </View>

            {detailsOpen && <DetailsRows analysis={currentAnalysis} />}
            {tryOpen && currentAnalysis.tryAgain && (
              <TryAgainPanel
                data={currentAnalysis.tryAgain}
                onClose={() => setTryOpen(false)}
              />
            )}
          </View>
        )}

        {/* Win Probability Graph */}
        <View style={styles.graphCard}>
          <Text style={styles.graphTitle}>WIN PROBABILITY</Text>
          <WinGraph
            points={review.winChanceHistory.map((w) => w.winChance)}
            current={currentStep}
            moments={review.decidingMoments.map((m) => m.moveNumber)}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 28,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.tertiaryLight,
    borderWidth: 1,
    borderColor: THEME.colors.tertiaryBorder,
  },
  resultDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.tertiary,
  },
  resultPillText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.tertiary,
  },
  modeSummaryText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  hudCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.card,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hudAvatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
  },
  hudMeta: {
    gap: 2,
  },
  hudName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  hudTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  wallCountTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  wallCountText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  hudTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  hudTimerText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.onSurface,
    fontVariant: ['tabular-nums'],
  },
  boardViewport: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  replayControlsCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    gap: 10,
    ...THEME.shadows.card,
  },
  moveCounterRow: {
    alignItems: 'center',
  },
  moveCounterText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
  },
  moveCounterHighlight: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderRadius: 2,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
  },
  mediaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mediaBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.inverseSurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  moveStrip: {
    gap: 6,
    paddingVertical: 2,
  },
  moveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moveChipActive: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderColor: THEME.colors.primary,
  },
  moveChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moveChipText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.onSurfaceVariant,
    fontVariant: ['tabular-nums'],
  },
  moveChipTextActive: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  analysisCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    gap: 8,
    ...THEME.shadows.card,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bestMovePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: THEME.colors.primaryLight,
  },
  bestMoveText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  insightText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.onSurface,
    lineHeight: 16,
  },
  analysisActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceContainerLow,
  },
  actionPillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  graphCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    gap: 8,
    ...THEME.shadows.card,
  },
  graphTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
  },
});
