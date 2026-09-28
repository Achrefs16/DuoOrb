import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
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
import {
  playGoalSound,
  playOpponentMoveSound,
  playOwnMoveSound,
  playWallSound,
} from '../audio/sounds';
import { THEME, playerColor } from '../theme';
import { assessmentColor, cleanName, ordinal } from '../analysisUi';

interface GameReviewScreenProps {
  initialState: GameState;
  history: RecordedAction[];
  perspectiveIdx?: number;
  onBack: () => void;
  /**
   * Bare match page: board, HUD cards and step controls only. Hides the
   * summary pill, analysis panels, try-again, details and win graph.
   * Used for History/Profile replays; the win/lose modal keeps full review.
   */
  bare?: boolean;
  /**
   * Real ratings by seat id, when the entry point knows them (the win/lose
   * modal hands over the live HUD numbers). Unknown seats render no rating
   * at all — never a placeholder.
   */
  ratings?: Record<string, number>;
}

/**
 * Full-review cache by game. Reopening a just-seen review skips the
 * multi-second recompute entirely. Capped: analysis objects are heavy.
 */
const REVIEW_CACHE = new Map<string, GameReview>();
const REVIEW_CACHE_LIMIT = 5;

function reviewCacheKey(gameId: string, historyLength: number): string {
  return `${gameId}:${historyLength}`;
}

function cacheReview(key: string, review: GameReview): void {
  REVIEW_CACHE.set(key, review);
  while (REVIEW_CACHE.size > REVIEW_CACHE_LIMIT) {
    const oldest = REVIEW_CACHE.keys().next();
    if (oldest.done) break;
    REVIEW_CACHE.delete(oldest.value);
  }
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
  bare = false,
  ratings,
}) => {
  // Full analysis, computed OFF the first paint. analyzeGame replays every
  // move with a search per move (seconds on a phone CPU), and it used to run
  // inside a useMemo during render — freezing the app from the Analyze tap
  // until the whole page could appear at once. Now the board and step
  // controls (which need only one cheap rebuild) paint immediately, and the
  // analysis lands afterwards with skeletons in its place. Bare replay never
  // computes it at all: it displays nothing from it.
  const [currentStep, setCurrentStep] = useState<number>(() =>
    history.length > 0 ? 1 : 0
  );
  // True once the user scrubs or plays: arriving analysis must not yank the
  // board out from under them to the deciding moment.
  const touchedRef = useRef(false);

  const [review, setReview] = useState<GameReview | null>(null);
  useEffect(() => {
    // Bare replay never computes: it displays nothing from the analysis.
    // (Initial state is already null, and the App key remounts per game,
    // so there is nothing to reset here.)
    if (bare) return;
    let cancelled = false;
    const key = reviewCacheKey(initialState.gameId, history.length);
    // One deferred task for both paths (even a cache hit goes through it):
    // setState never runs synchronously in this effect body, and the board
    // paints before any of this lands.
    const t = setTimeout(() => {
      if (cancelled) return;
      const cached = REVIEW_CACHE.get(key);
      const next =
        cached ??
        (() => {
          const computed = analyzeGame(initialState, history);
          cacheReview(key, computed);
          return computed;
        })();
      if (cancelled) return;
      setReview(next);
      if (!touchedRef.current) {
        const dm = next.decidingMoments[0];
        if (history.length > 0 && dm && dm.importance >= 25) {
          setCurrentStep(Math.max(1, Math.min(history.length, dm.moveNumber)));
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bare, initialState, history]);

  const [isPlaying, setIsPlaying] = useState(false);
  // Playback speed, cycled 1x -> 1.5x -> 2x -> 1x by a single button.
  const SPEEDS = [1, 1.5, 2];
  const [speedIdx, setSpeedIdx] = useState(0);
  const [showWhyOpen, setShowWhyOpen] = useState(false);
  const [tryOpen, setTryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Playback timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        touchedRef.current = true;
        setCurrentStep((prev) => {
          if (prev >= history.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1200 / SPEEDS[speedIdx]);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, history.length, speedIdx]);

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
    review && currentStep > 0 ? review.moveAnalyses[currentStep - 1] : undefined;

  /** State *before* the analyzed action — holds the mover's origin cell. */
  const preMoveState = useMemo(() => {
    return rebuildStateAtStep(initialState, history, currentStep - 1);
  }, [initialState, history, currentStep]);

  const goTo = (step: number) => {
    touchedRef.current = true;
    setCurrentStep(Math.max(0, Math.min(history.length, step)));
    setShowWhyOpen(false);
    setTryOpen(false);
  };

  // Movement sounds for replay: whenever the step advances (autoplay,
  // next, forward chip tap, forward swipe), voice the move that just
  // landed — same mapping as the live game. Scrubbing back stays silent.
  const prevStepRef = useRef(currentStep);
  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = currentStep;
    if (currentStep <= prev) return;
    const rec = history[currentStep - 1];
    if (!rec) return;
    if (rec.action.type === 'MOVE') {
      if (currentStep === history.length && currentState.winnerId) {
        void playGoalSound();
        return;
      }
      const myId = initialState.players[perspectiveIdx]?.id ?? null;
      if (myId && rec.playerId === myId) void playOwnMoveSound();
      else void playOpponentMoveSound();
    } else if (rec.action.type === 'PLACE_WALL') {
      void playWallSound();
    }
  }, [currentStep, history, currentState.winnerId, initialState, perspectiveIdx]);

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
    // Bare replay shows the plain board: no assessment-colored lines.
    if (bare || !currentAnalysis) return null;
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
  }, [bare, currentAnalysis, markColor, preMoveState]);

  const altMark = useMemo(() => {
    // Bare replay: no engine-best squares either.
    if (bare) return null;
    if (!showAlt || !currentAnalysis?.bestAction) return null;
    const ba = currentAnalysis.bestAction;
    if (ba.type === 'MOVE') {
      return { to: ba.to, color: THEME.colors.chartStroke };
    }
    if (ba.type === 'PLACE_WALL') {
      return { wall: ba.wall, color: THEME.colors.chartStroke };
    }
    return null;
  }, [bare, showAlt, currentAnalysis]);

  const opponentPlayer = currentState.players[1] || currentState.players[0];
  const userPlayer = currentState.players[0];

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{bare ? 'Match Replay' : 'Match Review'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Summary Pill Badge (review only) */}
        {!bare && (
        <View style={styles.summaryBadgeRow}>
          <View style={styles.resultPill}>
            <View style={styles.resultDot} />
            <Text style={styles.resultPillText}>Victory · +16</Text>
          </View>
          <Text style={styles.modeSummaryText}>Classic · 3+0</Text>
        </View>
        )}

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
                  {ratings?.[opponentPlayer.id] !== undefined && (
                    <Text style={styles.ratingText}>{ratings[opponentPlayer.id]}</Text>
                  )}
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
                  {ratings?.[userPlayer.id] !== undefined && (
                    <Text style={styles.ratingText}>{ratings[userPlayer.id]}</Text>
                  )}
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
              <Feather name={isPlaying ? 'pause' : 'play'} size={20} color={THEME.colors.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => {
                // Tapping speed always leaves playback running so the new
                // pace is visible immediately — even from paused.
                setSpeedIdx((prev) => (prev + 1) % SPEEDS.length);
                setIsPlaying(true);
              }}
            >
              <Text style={styles.speedText}>{SPEEDS[speedIdx]}×</Text>
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

            {/* Step counter, same as the match screen replay bar. */}
            {bare && (
              <Text style={styles.stepCounterText}>
                {currentStep} / {history.length}
              </Text>
            )}
          </View>

          {/* Move Strip Chips (review only — the bare match page keeps
              just the step controls above, like the in-game replay bar) */}
          {!bare && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moveStrip}
          >
            {Array.from({ length: history.length }, (_, i) => i + 1).map((stepNum) => {
              const isActive = currentStep === stepNum;
              // Bare mode (or analysis still computing): plain step chips,
              // no engine assessment dots.
              const analysis = bare || !review ? undefined : review.moveAnalyses[stepNum - 1];
              const dotColor = analysis ? assessmentColor(analysis.assessment) : THEME.colors.primary;

              return (
                <TouchableOpacity
                  key={stepNum}
                  style={[styles.moveChip, isActive && styles.moveChipActive]}
                  onPress={() => goTo(stepNum)}
                >
                  {!bare && <View style={[styles.moveChipDot, { backgroundColor: dotColor }]} />}
                  <Text style={[styles.moveChipText, isActive && styles.moveChipTextActive]}>
                    {stepNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          )}
        </View>

        {/* Engine Analysis Panels (review only) */}
        {!bare && currentAnalysis && (
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

        {/* Win Probability Graph (review only, once computed) */}
        {!bare && review && (
        <View style={styles.graphCard}>
          <Text style={styles.graphTitle}>WIN PROBABILITY</Text>
          <WinGraph
            points={review.winChanceHistory.map((w) => w.winChance)}
            current={currentStep}
            moments={review.decidingMoments.map((m) => m.moveNumber)}
          />
        </View>
        )}

        {/* Analysis loading skeleton: the board and step controls above
            paint immediately; this holds the place of the gated sections
            while the deferred compute runs. */}
        {!bare && !review && (
        <View style={styles.graphCard}>
          <Text style={styles.graphTitle}>ANALYZING</Text>
          <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
        </View>
        )}
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
    shadowColor: THEME.colors.shadowBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  speedText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  stepCounterText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginLeft: 4,
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
