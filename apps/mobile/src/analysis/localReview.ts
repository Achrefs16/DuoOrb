import {
  AI_PROFILES,
  GameReview,
  GameState,
  MoveAnalysis,
  MoveAssessment,
  RecordedAction,
  applyAction,
  evaluateState,
  getBestActionAsync,
} from '@duoorb/game-core';

/**
 * On-device match review used when the Rust analysis service is unreachable.
 *
 * It is intentionally lightweight: every recorded action is compared against
 * the mobile MCTS engine's best reply under a small time budget, and the
 * evaluation loss drives the assessment. The server remains the deep pass;
 * this keeps offline review useful instead of leaving an endless spinner.
 */
const LOCAL_PROFILE = AI_PROFILES.normal;
const DEFAULT_MOVE_BUDGET_MS = 55;

interface LocalReviewOptions {
  /** Short budget per ply. Tests can lower it; production keeps it small. */
  budgetMs?: number;
  /** Stop after this action (screen unmounted). */
  isCancelled?: () => boolean;
  keyLessonTitle?: string;
  keyLessonDetail?: string;
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Convert an engine score into a win probability from the first seat. */
function winChanceFor(state: GameState, playerId: string | undefined): number {
  if (!playerId) return 0.5;
  const score = evaluateState(state, playerId, LOCAL_PROFILE);
  return clamp01(1 / (1 + Math.exp(-score / 18)));
}

function assessLoss(
  loss: number,
  sameAction: boolean,
  moverWinBefore: number,
  moverWinAfter: number
): MoveAssessment {
  const isBest = sameAction || loss <= 0.5;
  if (isBest) {
    if (
      moverWinBefore <= 0.46 &&
      moverWinAfter >= 0.58 &&
      (moverWinAfter - moverWinBefore >= 0.18 || (moverWinBefore <= 0.38 && moverWinAfter >= 0.54))
    ) {
      return 'BRILLIANT';
    }
    if (moverWinAfter - moverWinBefore >= 0.12 && moverWinAfter >= 0.62) {
      return 'GREAT';
    }
    return 'BEST';
  }
  if (loss <= 2) return 'EXCELLENT';
  if (loss <= 5) return 'GOOD';
  if (loss <= 10) return 'INACCURACY';
  if (loss <= 20) return 'MISTAKE';
  return 'BLUNDER';
}

function accuracyFor(loss: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - loss * 2.5)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function analyzeMatchLocal(
  initialState: GameState,
  history: RecordedAction[],
  options: LocalReviewOptions = {}
): Promise<GameReview> {
  const budgetMs = Math.max(1, options.budgetMs ?? DEFAULT_MOVE_BUDGET_MS);
  const p1Id = initialState.players[0]?.id;
  const analyses: MoveAnalysis[] = [];
  const winChanceHistory: { step: number; winChance: number }[] = [
    { step: 0, winChance: winChanceFor(initialState, p1Id) },
  ];
  const evaluationHistory: { step: number; evaluation: number }[] = [
    { step: 0, evaluation: p1Id ? evaluateState(initialState, p1Id, LOCAL_PROFILE) : 0 },
  ];

  let before = initialState;
  for (let i = 0; i < history.length; i++) {
    if (options.isCancelled?.()) break;

    const recorded = history[i];
    const moverId =
      recorded.playerId ||
      before.players[before.currentPlayerIndex]?.id ||
      before.players[0]?.id ||
      '';
    const played = applyAction(before, recorded.action, {
      timestamp: recorded.timestamp,
      clockRemainingMs: recorded.clockRemainingMs,
      actorId: recorded.playerId,
    });
    if (!played.success) {
      // A corrupt/unsupported replay should not abort every later move.
      break;
    }
    const after = played.state;
    const beforeScore = evaluateState(before, moverId, LOCAL_PROFILE);

    const bestAction =
      before.status === 'IN_PROGRESS'
        ? await getBestActionAsync(before, LOCAL_PROFILE, 0x5eed + i, {
            budget: { timeMs: budgetMs, maxDepth: 2 },
            shouldCancel: options.isCancelled,
          })
        : null;

    let bestScore = beforeScore;
    let bestState: GameState | null = null;
    if (bestAction) {
      const best = applyAction(before, bestAction, {
        timestamp: recorded.timestamp,
        actorId: moverId,
      });
      if (best.success) {
        bestState = best.state;
        bestScore = evaluateState(best.state, moverId, LOCAL_PROFILE);
      }
    }

    const playedScore = evaluateState(after, moverId, LOCAL_PROFILE);
    const loss = Math.max(0, bestScore - playedScore);
    const sameAction = bestAction ? actionsEqual(playedActionOf(recorded.action), bestAction) : false;
    const moverWinBefore = winChanceFor(before, moverId);
    const moverWinAfter = winChanceFor(after, moverId);
    const assessment = assessLoss(loss, sameAction, moverWinBefore, moverWinAfter);
    const moveAccuracy = accuracyFor(loss);
    const winChanceAfter = winChanceFor(after, p1Id);

    analyses.push({
      step: i + 1,
      playerId: moverId,
      playedAction: recorded.action,
      evaluationBefore: beforeScore,
      evaluationAfter: playedScore,
      evaluationDelta: playedScore - beforeScore,
      bestAction,
      bestActionEvaluation: bestScore,
      assessment,
      evaluationLoss: loss,
      winChanceBefore: winChanceFor(before, p1Id),
      winChanceAfter,
      winChanceSwing: winChanceAfter - winChanceFor(before, p1Id),
      forced: bestAction == null,
      critical: assessment === 'MISTAKE' || assessment === 'BLUNDER',
      moveAccuracy,
      tryAgain:
        bestAction && bestState && (assessment === 'MISTAKE' || assessment === 'BLUNDER')
          ? {
              stateBefore: before,
              playedAction: recorded.action,
              bestAction,
              acceptableActions: [],
              expectedEval: bestScore,
            }
          : undefined,
    });
    winChanceHistory.push({ step: i + 1, winChance: winChanceAfter });
    evaluationHistory.push({
      step: i + 1,
      evaluation: p1Id ? evaluateState(after, p1Id, LOCAL_PROFILE) : 0,
    });
    before = after;
  }

  const accuracy: Record<string, { accuracy: number; moves: number }> = {};
  const accuracies: Record<string, number> = {};
  for (const player of initialState.players) {
    const moves = analyses.filter((move) => move.playerId === player.id);
    const playerAccuracy = Math.round(average(moves.map((move) => move.moveAccuracy ?? 0)));
    accuracy[player.id] = { accuracy: playerAccuracy, moves: moves.length };
    const shortKey = `p${player.index + 1}`;
    accuracies[shortKey] = playerAccuracy;
  }

  const counts = analyses.reduce(
    (acc, move) => {
      switch (move.assessment) {
        case 'BRILLIANT':
          acc.brilliantMoves = (acc.brilliantMoves || 0) + 1;
          break;
        case 'GREAT':
          acc.greatMoves = (acc.greatMoves || 0) + 1;
          break;
        case 'BEST':
          acc.bestMoves++;
          break;
        case 'EXCELLENT':
          acc.excellentMoves++;
          break;
        case 'GOOD':
          acc.goodMoves++;
          break;
        case 'INACCURACY':
          acc.inaccuracies++;
          break;
        case 'MISTAKE':
          acc.mistakes++;
          break;
        case 'BLUNDER':
          acc.blunders++;
          break;
        default:
          break;
      }
      return acc;
    },
    {
      brilliantMoves: 0,
      greatMoves: 0,
      bestMoves: 0,
      excellentMoves: 0,
      goodMoves: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
    }
  );

  return {
    totalMoves: analyses.length,
    winnerId: before.winnerId,
    moveAnalyses: analyses,
    evaluationHistory,
    winChanceHistory,
    accuracies,
    criticalMoments: analyses
      .filter(
        (move) =>
          move.assessment === 'MISTAKE' ||
          move.assessment === 'BLUNDER' ||
          move.assessment === 'BRILLIANT' ||
          move.assessment === 'GREAT'
      )
      .map((move) => move.step),
    engineVersion: 'duoorb-mobile-mcts-local',
    analysisVersion: 'analysis-local-1.0',
    rulesetVersion: initialState.rulesetVersion,
    profile: 'fast',
    summary: {
      accuracy,
      confidence: 'low',
      totalMoves: analyses.length,
      ...counts,
      keyLesson: {
        title: options.keyLessonTitle ?? 'On-device review',
        detail:
          options.keyLessonDetail ??
          'This review ran on your device. Reconnect for the full cloud analysis.',
      },
    },
  };
}

/**
 * Narrow a recorded GameAction while preserving the fields the equality
 * helper needs. Keeping this in one place avoids a second action shape.
 */
function playedActionOf(action: RecordedAction['action']): RecordedAction['action'] {
  return action;
}
