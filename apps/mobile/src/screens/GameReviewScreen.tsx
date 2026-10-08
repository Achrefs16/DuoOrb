import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Animated, PanResponder, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  GameReview,
  GameState,
  MoveAnalysis,
  RecordedAction,
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
import { THEME, playerColor, useStyles, useTheme } from '../theme';
import {
  ENGINE_TEAL,
  assessmentBadgeColor,
  assessmentColor,
  assessmentGlyph,
  assessmentVerdictKey,
  cleanName,
  formatEvalShort,
  ordinal,
  shortMoveLabel,
} from '../analysisUi';
import { RewardSheet } from '../components/RewardSheet';
import { showRewarded } from '../monetization/ads';
import {
  markAnalysisUnlocked,
  useAnalysisAccess,
} from '../monetization/analysisAccess';
import { api } from '../network/apiClient';
import { useTranslation } from '../i18n';

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
  /**
   * Analysis gate key for full reviews (win/lose modal only). Bare replays
   * pass null and never compute. The screen re-verifies access itself, so a
   * premium expiry mid-review (E14) stops NEW computes without yanking an
   * already-rendered review.
   */
  accessKey?: { gameId: string; historyLength: number } | null;
  /**
   * Bare -> full upgrade (History/Profile Analyze path). The screen runs the
   * same premium / one-ad gate as the win/lose modal, then calls this so the
   * App remounts into full mode. Absent (or no accessKey): no upgrade offered.
   */
  onUpgradeToFull?: () => void;
  /** Paywall entry for the upgrade sheet's premium row. */
  onOpenPremium?: () => void;
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
  accessKey = null,
  onUpgradeToFull,
  onOpenPremium,
}) => {
  const styles = useStyles(createStyles);
  const theme = useTheme();
  const { t } = useTranslation();
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
  // Defense-in-depth access check (MONETIZATION.md P3.3): the GameScreen gate
  // normally guarantees access before navigating here, but this hook
  // re-verifies from live state — an expiry mid-review simply prevents a
  // recompute, never yanks rendered content (E14).
  const { access, recheck } = useAnalysisAccess(
    accessKey?.gameId ?? null,
    accessKey?.historyLength ?? history.length
  );
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  // Bare -> full upgrade sheet (History/Profile Analyze path): same
  // one-ad-per-game rule as the GameScreen gate, same RewardSheet copy.
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);

  // Chess-style full review controls (UI only — analysis data untouched).
  // showLine: engine-best overlay on the board (arrow for moves, ghost for
  // walls). isolateBest (Best button): hides the played move, best only.
  const [showLine, setShowLine] = useState(true);
  const [isolateBest, setIsolateBest] = useState(false);

  // Bare replay Analyze tap: premium/unlocked (dev builds resolve unlocked
  // via the bypass, so iteration never touches an ad) upgrade immediately;
  // locked opens the sheet instead. Re-opening an upgraded game is free —
  // the unlock key is per gameId:historyLength (E13).
  const handleAnalyzeUpgrade = () => {
    if (!accessKey || !onUpgradeToFull) return;
    if (access === 'premium' || access === 'unlocked') {
      onUpgradeToFull();
      return;
    }
    if (access === 'locked') {
      setRewardError(null);
      setRewardOpen(true);
    }
  };

  const handleWatchUpgradeAd = async () => {
    if (!accessKey || rewardBusy) return;
    setRewardBusy(true);
    setRewardError(null);
    const res = await showRewarded('analysis');
    if (res.earned) {
      try {
        await markAnalysisUnlocked(accessKey.gameId, accessKey.historyLength);
        setRewardOpen(false);
        // Full mode re-verifies access itself (P3.3), so a failed write
        // could never strand the user on an unlocked-looking review.
        onUpgradeToFull?.();
      } catch {
        // E12: the unlock write failed — stay locked, say so, retry allowed.
        setRewardError('store');
      }
    } else {
      // E10/E11: early close, no fill, or SDK error — sheet stays, no dead end.
      setRewardError(res.error ?? 'dismissed');
    }
    setRewardBusy(false);
  };

  // In-review unlock (backstop for the GameScreen sheet): same one-ad-per-game
  // rule, same cache. Runs only when the gate somehow opened this screen
  // locked — normally the sheet completes the unlock before navigation.
  const handleUnlockHere = async () => {
    if (!accessKey || unlockBusy) return;
    setUnlockBusy(true);
    setUnlockError(null);
    const res = await showRewarded('analysis');
    if (res.earned) {
      try {
        await markAnalysisUnlocked(accessKey.gameId, accessKey.historyLength);
        await recheck();
      } catch {
        setUnlockError('store');
      }
    } else {
      setUnlockError(res.error ?? 'dismissed');
    }
    setUnlockBusy(false);
  };
  useEffect(() => {
    // Bare replay never computes: it displays nothing from the analysis.
    // (Initial state is already null, and the App key remounts per game,
    // so there is nothing to reset here.)
    if (bare) return;
    // Locked (and still-checking) full reviews never start the multi-second
    // compute: the locked panel below offers the ad unlock instead.
    if (access !== 'premium' && access !== 'unlocked') return;
    let cancelled = false;
    const key = reviewCacheKey(initialState.gameId, history.length);
    // One deferred task for both paths (even a cache hit goes through it):
    // setState never runs synchronously in this effect body, and the board
    // paints before any of this lands.
    const t = setTimeout(async () => {
      if (cancelled) return;
      const cached = REVIEW_CACHE.get(key);
      if (cached) {
        if (!cancelled) setReview(cached);
        return;
      }

      // Request deep MCTS analysis from the backend server (sole source of truth)
      try {
        const serverReview = await api.requestGameReview(initialState, history);
        if (cancelled) return;
        if (serverReview && Array.isArray(serverReview.moveAnalyses)) {
          cacheReview(key, serverReview);
          setReview(serverReview);
          return;
        }
      } catch (err) {
        console.warn('Server analysis request failed:', err);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bare, initialState, history, access]);

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
    const solid =
      currentAnalysis.assessment === 'MISTAKE' ||
      currentAnalysis.assessment === 'BLUNDER';
    if (pa.type === 'MOVE') {
      const origin = preMoveState.players.find(
        (p) => p.id === currentAnalysis.playerId
      )?.position;
      return {
        from: origin,
        to: pa.to,
        color: markColor,
        solid,
      };
    }
    if (pa.type === 'PLACE_WALL') {
      return {
        wall: pa.wall,
        color: markColor,
        solid,
      };
    }
    return null;
  }, [bare, currentAnalysis, markColor, preMoveState]);

  const altMark = useMemo(() => {
    // Bare replay: no engine-best squares either. Best piece moves render
    // as the review arrow now — the ghost/hollow stays walls-only.
    if (bare) return null;
    if (!showAlt || !currentAnalysis?.bestAction) return null;
    const ba = currentAnalysis.bestAction;
    if (ba.type === 'MOVE') return null;
    if (ba.type === 'PLACE_WALL') {
      return { wall: ba.wall, color: THEME.colors.chartStroke };
    }
    return null;
  }, [bare, showAlt, currentAnalysis, theme]);

  // Classification badge (?? / ? / ?! / !) pinned on the destination.
  const badgeMark = useMemo(() => {
    if (bare || !currentAnalysis) return null;
    const glyph = assessmentGlyph(currentAnalysis.assessment);
    if (!glyph) return null;
    const pa = currentAnalysis.playedAction;
    const cell =
      pa.type === 'MOVE'
        ? pa.to
        : pa.type === 'PLACE_WALL'
          ? { row: pa.wall.row, col: pa.wall.col }
          : null;
    if (!cell) return null;
    return { cell, glyph, color: assessmentBadgeColor(currentAnalysis.assessment) };
  }, [bare, currentAnalysis]);

  // Best-move arrow: mover's origin -> engine destination (piece moves).
  const bestArrow = useMemo(() => {
    if (bare || !showLine || !currentAnalysis?.bestAction) return null;
    const ba = currentAnalysis.bestAction;
    if (ba.type !== 'MOVE') return null;
    const origin = preMoveState.players.find(
      (p) => p.id === currentAnalysis.playerId
    )?.position;
    if (!origin) return null;
    if (origin.row === ba.to.row && origin.col === ba.to.col) return null;
    return { from: origin, to: ba.to, color: ENGINE_TEAL };
  }, [bare, showLine, currentAnalysis, preMoveState]);

  // Eval bar inputs: viewer's win chance + eval at the current step.
  // Histories are per-step; entries at/below the step win, latest fallback.
  const viewerId = initialState.players[perspectiveIdx]?.id ?? null;
  const viewerIdx = initialState.players[perspectiveIdx]?.index ?? 0;
  const viewerColor = playerColor(viewerIdx, initialState.players[perspectiveIdx]?.color);
  const wcEntry = useMemo(() => {
    const h = review?.winChanceHistory ?? [];
    let found: { step: number; winChance: number; perPlayer?: Record<string, number> } | null = null;
    for (const e of h) {
      if (e.step <= currentStep) found = e;
      else break;
    }
    return found ?? h[h.length - 1] ?? null;
  }, [review, currentStep]);
  const viewerWC = useMemo(() => {
    if (!wcEntry) return 0.5;
    if (viewerId && wcEntry.perPlayer?.[viewerId] !== undefined) {
      return wcEntry.perPlayer[viewerId];
    }
    const moverId = review?.moveAnalyses[currentStep - 1]?.playerId ?? null;
    return moverId != null && moverId === viewerId
      ? wcEntry.winChance
      : 1 - wcEntry.winChance;
  }, [wcEntry, viewerId, review, currentStep]);
  const evalNum = useMemo(() => {
    const h = review?.evaluationHistory ?? [];
    let found: { step: number; evaluation: number } | null = null;
    for (const e of h) {
      if (e.step <= currentStep) found = e;
      else break;
    }
    return (found ?? h[h.length - 1] ?? null)?.evaluation ?? null;
  }, [review, currentStep]);

  // Key moments for Next: deciding moments in move order; Next disables
  // past the last one (no wrap).
  const keyMoments = useMemo(() => {
    return [...(review?.decidingMoments ?? [])].sort(
      (a, b) => a.moveNumber - b.moveNumber
    );
  }, [review]);
  const nextMoment = keyMoments.find((m) => m.moveNumber > currentStep) ?? null;

  // Move strip window: around the current step, clamped, padded backwards.
  const stripSteps = useMemo(() => {
    const total = history.length;
    const out: number[] = [];
    for (
      let s = Math.max(1, currentStep - 1);
      s <= Math.min(total, currentStep + 2) && out.length < 5;
      s++
    ) {
      out.push(s);
    }
    while (out.length < Math.min(5, total) && out[0] > 1) {
      out.unshift(out[0] - 1);
    }
    return out;
  }, [history.length, currentStep]);
  const stripLabel = (step: number): string => {
    const rec = history[step - 1];
    if (!rec) return `${step}`;
    const idx = initialState.players.findIndex((p) => p.id === rec.playerId);
    return shortMoveLabel(rec.action, idx < 0 ? 0 : initialState.players[idx].index);
  };
  const stripAssessment = (step: number) =>
    review?.moveAnalyses[step - 1]?.assessment ?? null;

  const opponentPlayer = currentState.players[1] || currentState.players[0];
  const userPlayer = currentState.players[0];

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{bare ? t('review.matchReplay') : t('review.matchReview')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Bare replays scroll the classic layout. Full reviews use the fixed
          chess-style column — except locked ones, which keep the scroll
          layout that owns the unlock panel (matters once the temp
          always-open flag flips back). */}
      {(bare || (!review && access === 'locked')) ? (
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
            <Text style={styles.resultPillText}>{t('result.victory')} · +16</Text>
          </View>
          <Text style={styles.modeSummaryText}>{t('setup.classic')} · 3+0</Text>
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
                    <Text style={styles.wallCountText}>
                      {t('review.wallsCount', { count: opponentPlayer.wallsRemaining })}
                    </Text>
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
                <Text style={styles.hudName}>{userPlayer.displayName} {t('gameover.you')}</Text>
                <View style={styles.hudTagRow}>
                  {ratings?.[userPlayer.id] !== undefined && (
                    <Text style={styles.ratingText}>{ratings[userPlayer.id]}</Text>
                  )}
                  <View style={styles.wallCountTag}>
                    <Text style={styles.wallCountText}>
                      {t('review.wallsCount', { count: userPlayer.wallsRemaining })}
                    </Text>
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
              {t('review.moveCounter', { current: currentStep, total: history.length })}
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
              <Feather name={isPlaying ? 'pause' : 'play'} size={20} color={THEME.colors.inverseOnSurface} />
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

        {/* Bare -> full upgrade (History/Profile Analyze path): same gate as
            the win/lose modal — premium/dev/unlocked go straight to review,
            locked gets the one-ad sheet. Dev builds never see the sheet. */}
        {bare && accessKey && onUpgradeToFull && (
        <TouchableOpacity
          style={[styles.upgradeBtn, access === 'checking' && styles.btnDisabled]}
          onPress={handleAnalyzeUpgrade}
          disabled={access === 'checking'}
          accessibilityRole="button"
          accessibilityLabel="Analyze this game"
        >
          {access === 'checking' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather
                name={access === 'locked' ? 'lock' : 'bar-chart-2'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.upgradeBtnText}>{t('gameover.analyze')}</Text>
            </>
          )}
        </TouchableOpacity>
        )}

        {/* Engine Analysis Panels (review only) */}
        {!bare && currentAnalysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeaderRow}>
              <AnalysisBadge assessment={currentAnalysis.assessment} />
              {showAlt && currentAnalysis.bestAction && (
                <View style={styles.bestMovePill}>
                  <Text style={styles.bestMoveText}>
                    {currentAnalysis.bestAction.type === 'MOVE' ? t('review.engineMove') : t('review.engineWall')}
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
                  <Text style={styles.actionPillText}>{t('review.tryAgain')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionPillBtn}
                onPress={() => setDetailsOpen((v) => !v)}
              >
                <Text style={styles.actionPillText}>{detailsOpen ? t('review.hideDetails') : t('review.details')}</Text>
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
          <Text style={styles.graphTitle}>{t('review.winProbability')}</Text>
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
        {!bare && !review && (access === 'checking' || access === 'premium' || access === 'unlocked') && (
        <View style={styles.graphCard}>
          <Text style={styles.graphTitle}>{t('review.analyzing')}</Text>
          <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
        </View>
        )}

        {/* Locked full review (MONETIZATION.md P3.3): board + step controls
            above stay fully usable; this panel offers the one-ad unlock or the
            way back. Rendered only when nothing was computed yet — an
            expiry mid-review never yanks rendered content (E14). */}
        {!bare && !review && access === 'locked' && (
        <View style={styles.lockCard}>
          <Feather name="lock" size={20} color={THEME.colors.primary} />
          <Text style={styles.lockTitle}>{t('review.lockedTitle')}</Text>
          <Text style={styles.lockCopy}>
            {t('review.lockedSub')}
          </Text>
          {accessKey && (
          <TouchableOpacity
            style={styles.lockButton}
            onPress={handleUnlockHere}
            disabled={unlockBusy}
            accessibilityRole="button"
            accessibilityLabel="Watch ad to unlock analysis"
          >
            {unlockBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.lockButtonText}>{t('review.watchAd')}</Text>
            )}
          </TouchableOpacity>
          )}
          {unlockError && (
            <Text style={styles.lockError}>
              {unlockError === 'unavailable'
                ? "Ads aren't available right now — check your connection and try again."
                : unlockError === 'store'
                  ? "Couldn't save the unlock — please try again."
                  : 'No problem — the analysis stays locked for this game.'}
            </Text>
          )}
          <TouchableOpacity onPress={onBack} disabled={unlockBusy}>
            <Text style={styles.lockBack}>{t('review.backToMatch')}</Text>
          </TouchableOpacity>
        </View>
        )}
      </ScrollView>
      ) : (
      <View style={styles.fullBody}>
        {/* Eval bar: who's winning, by how much, exact number — always on. */}
        <View style={styles.evalBarRow}>
          <Text style={styles.evalNum}>
            {evalNum == null ? '—' : formatEvalShort(evalNum)}
          </Text>
          <View style={styles.evalTrack}>
            <View
              style={[
                styles.evalFill,
                {
                  width: `${Math.max(0, Math.min(100, Math.round(viewerWC * 100)))}%`,
                  backgroundColor: viewerColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Coach: one verdict + one sentence. */}
        {currentAnalysis ? (
          <View style={styles.coachCard}>
            <View style={[styles.coachAvatar, { backgroundColor: moverColor }]}>
              <Text style={styles.coachAvatarText}>
                {(moverName.charAt(0) || '•').toUpperCase()}
              </Text>
            </View>
            <View style={styles.coachMain}>
              <View style={styles.verdictRow}>
                {assessmentGlyph(currentAnalysis.assessment) !== '' && (
                  <View
                    style={[
                      styles.glyphBadge,
                      {
                        backgroundColor: assessmentBadgeColor(
                          currentAnalysis.assessment
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.glyphText}>
                      {assessmentGlyph(currentAnalysis.assessment)}
                    </Text>
                  </View>
                )}
                <Text style={styles.verdictText}>
                  {t('review.verdictIsA', {
                    label: shortMoveLabel(
                      currentAnalysis.playedAction,
                      mover?.index ?? 0
                    ),
                    verdict: t(assessmentVerdictKey(currentAnalysis.assessment)),
                  })}
                </Text>
                <View style={styles.evalPill}>
                  <Text style={styles.evalPillText}>
                    {formatEvalShort(currentAnalysis.evaluationAfter)}
                  </Text>
                </View>
              </View>
              <Text style={styles.coachText} numberOfLines={3}>
                {currentAnalysis.explanation}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.coachCard}>
            <ActivityIndicator size="small" color={THEME.colors.primary} />
            <Text style={styles.coachText}>{t('review.analyzing')}</Text>
          </View>
        )}

        {/* Board viewport (swipe steps like the replay bar). */}
        <View {...swipe.panHandlers} style={styles.fullBoardWrap}>
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
              moveMark={isolateBest ? null : moveMark}
              altMark={showLine ? altMark : null}
              badgeMark={isolateBest ? null : badgeMark}
              bestArrow={showLine ? bestArrow : null}
              flipAnim={flip}
            />
          </Animated.View>
        </View>

        {/* Move strip navigator. */}
        <View style={styles.stripRow}>
          <TouchableOpacity
            style={styles.stripNav}
            disabled={currentStep <= 1}
            onPress={() => goTo(currentStep - 1)}
            accessibilityRole="button"
            accessibilityLabel="Previous move"
          >
            <Feather
              name="chevron-left"
              size={20}
              color={
                currentStep <= 1
                  ? THEME.colors.textMuted
                  : THEME.colors.textSecondary
              }
            />
          </TouchableOpacity>
          {stripSteps.map((s) => {
            const a = stripAssessment(s);
            const bad = a === 'MISTAKE' || a === 'BLUNDER';
            const active = s === currentStep;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.stripChip, active && styles.stripChipActive]}
                onPress={() => goTo(s)}
              >
                <Text
                  style={[
                    styles.stripChipText,
                    active && styles.stripChipTextActive,
                  ]}
                >
                  {s} · {stripLabel(s)}
                </Text>
                {bad && <View style={styles.stripBad} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.stripNav}
            disabled={currentStep >= history.length}
            onPress={() => goTo(currentStep + 1)}
            accessibilityRole="button"
            accessibilityLabel="Next move"
          >
            <Feather
              name="chevron-right"
              size={20}
              color={
                currentStep >= history.length
                  ? THEME.colors.textMuted
                  : THEME.colors.textSecondary
              }
            />
          </TouchableOpacity>
        </View>

        {/* Action bar: Show / Best / Next. */}
        <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.actionBtn, showLine && styles.actionBtnActive]}
              onPress={() => setShowLine((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Show engine line"
            >
              <Feather
                name="eye"
                size={18}
                color={
                  showLine ? THEME.colors.primary : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.actionLabel,
                  showLine && { color: THEME.colors.primary },
                ]}
              >
                {t('review.show')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isolateBest && styles.actionBtnActive]}
              onPress={() => {
                setIsolateBest((v) => !v);
                setShowLine(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Isolate best move"
            >
              <Feather
                name="star"
                size={18}
                color={
                  isolateBest
                    ? THEME.colors.primary
                    : THEME.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.actionLabel,
                  isolateBest && { color: THEME.colors.primary },
                ]}
              >
                {t('review.best')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, !nextMoment && styles.btnDisabled]}
              disabled={!nextMoment}
              onPress={() => nextMoment && goTo(nextMoment.moveNumber)}
              accessibilityRole="button"
              accessibilityLabel="Next key moment"
            >
              <Text style={styles.nextBtnText}>{t('review.next')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Upgrade sheet for the bare Analyze path (History/Profile). */}
      <RewardSheet
        visible={rewardOpen}
        busy={rewardBusy}
        error={rewardError}
        onWatch={handleWatchUpgradeAd}
        onPremium={() => {
          setRewardOpen(false);
          onOpenPremium?.();
        }}
        onClose={() => setRewardOpen(false)}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
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
  // Locked-review panel (MONETIZATION.md P3.3): same card language as the
  // graph/analysis cards, centered content, single ad action + way back.
  lockCard: {
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 20,
    gap: 8,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  lockTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  lockCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  lockButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 4,
    minWidth: 160,
    alignItems: 'center',
  },
  lockButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  lockError: {
    fontSize: 12,
    color: THEME.colors.danger,
    textAlign: 'center',
  },
  lockBack: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginTop: 4,
    paddingVertical: 6,
  },
  // Chess-style full review: fixed column, board takes the free space.
  fullBody: {
    flex: 1,
    gap: 8,
    paddingBottom: 4,
  },
  // Eval bar: number + viewer-share track.
  evalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  evalNum: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    minWidth: 44,
  },
  evalTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.surfaceContainer,
    overflow: 'hidden',
  },
  evalFill: {
    height: 10,
    borderRadius: 5,
  },
  // Coach card: avatar disc + verdict row + one-sentence explanation.
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    padding: 12,
    ...THEME.shadows.card,
  },
  coachAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    fontWeight: '800',
  },
  coachMain: {
    flex: 1,
    gap: 4,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '800',
  },
  verdictText: {
    flex: 1,
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  evalPill: {
    backgroundColor: THEME.colors.textPrimary,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  evalPillText: {
    color: THEME.colors.inverseOnSurface,
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '800',
  },
  coachText: {
    fontSize: 13,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
  },
  // Board takes all free space between coach and strip.
  fullBoardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Move strip navigator.
  stripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripNav: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: THEME.radius.md,
    backgroundColor: 'transparent',
  },
  stripChipActive: {
    backgroundColor: THEME.colors.surfaceContainer,
  },
  stripChipText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  stripChipTextActive: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  stripBad: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.danger,
  },
  // Bottom action bar: Show / Best / Retry + Next CTA.
  actionBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: THEME.radius.md,
  },
  actionBtnActive: {
    backgroundColor: THEME.colors.surfaceContainer,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  nextBtn: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '800',
  },
  ghostAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    backgroundColor: THEME.colors.backgroundCard,
  },
  ghostActionText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  // Bare -> full upgrade button (History/Profile Analyze path): primary
  // CTA under the step controls, same language as the win/lose modal row.
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.lg,
    paddingVertical: 13,
    marginTop: 4,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '800',
  },
});
