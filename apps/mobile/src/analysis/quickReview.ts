import {
  applyAction,
  getLegalMoves,
  getShortestDistance,
  type GameAction,
  type GameState,
  type MoveAssessment,
  type PlayerState,
  type RecordedAction,
} from '@duoorb/game-core';

/**
 * A deliberately shallow, on-device review used only to fill the finish-modal
 * badges while the user is looking at the result. The server review remains
 * the authoritative analysis.
 *
 * This is a one-ply check: it compares the played move with the best immediate
 * move and measures the detour created by a wall. It does not search for traps
 * or multi-move plans, which is why the UI labels it as a quick estimate.
 */
export type MoveQualityCounts = Record<MoveAssessment, number>;

export interface GameOverBadgeSelection {
  left: MoveAssessment;
  middle: 'BEST';
  right: MoveAssessment;
}

const QUICK_REVIEW_CACHE = new Map<string, MoveQualityCounts>();
const QUICK_REVIEW_CACHE_LIMIT = 12;

const LEFT_PRIORITY: MoveAssessment[] = [
  'BRILLIANT',
  'GREAT',
  'EXCELLENT',
  'GOOD',
];
const RIGHT_PRIORITY: MoveAssessment[] = ['BLUNDER', 'MISTAKE', 'INACCURACY'];
const RIGHT_POSITIVE_FALLBACK: MoveAssessment[] = [
  'EXCELLENT',
  'GREAT',
  'GOOD',
  'BRILLIANT',
];

export function emptyMoveQualityCounts(): MoveQualityCounts {
  return {
    BRILLIANT: 0,
    GREAT: 0,
    BEST: 0,
    EXCELLENT: 0,
    GOOD: 0,
    INACCURACY: 0,
    MISTAKE: 0,
    BLUNDER: 0,
    FORCED: 0,
  };
}

/**
 * Modal layout rule:
 * - left is the best positive non-Best signal,
 * - middle is always Best,
 * - right is the worst negative signal when present, otherwise the next
 *   positive signal so the row never jumps or shows a meaningless red zero.
 */
export function selectGameOverBadges(
  counts: MoveQualityCounts
): GameOverBadgeSelection {
  const left =
    LEFT_PRIORITY.find((assessment) => counts[assessment] > 0) ?? 'GREAT';

  let right = RIGHT_PRIORITY.find((assessment) => counts[assessment] > 0);
  if (!right) {
    right = RIGHT_POSITIVE_FALLBACK.find(
      (assessment) => assessment !== left && counts[assessment] > 0
    );
  }
  if (!right) {
    right = left === 'EXCELLENT' ? 'GREAT' : 'EXCELLENT';
  }

  return { left, middle: 'BEST', right };
}

export function getQuickReviewCounts(
  initialState: GameState,
  history: RecordedAction[],
  playerId: string
): MoveQualityCounts {
  const cacheKey = `${initialState.gameId}:${history.length}:${playerId}`;
  const cached = QUICK_REVIEW_CACHE.get(cacheKey);
  if (cached) return cached;

  const counts = computeQuickReviewCounts(initialState, history, playerId);

  QUICK_REVIEW_CACHE.set(cacheKey, counts);
  while (QUICK_REVIEW_CACHE.size > QUICK_REVIEW_CACHE_LIMIT) {
    const oldest = QUICK_REVIEW_CACHE.keys().next();
    if (oldest.done) break;
    QUICK_REVIEW_CACHE.delete(oldest.value);
  }

  return counts;
}

function computeQuickReviewCounts(
  initialState: GameState,
  history: RecordedAction[],
  playerId: string
): MoveQualityCounts {
  const counts = emptyMoveQualityCounts();
  let state = initialState;

  for (const record of history) {
    if (state.status !== 'IN_PROGRESS') break;
    if (record.action.type === 'RESIGN' || record.action.type === 'TIMEOUT') {
      continue;
    }

    const moverIndex = state.players.findIndex(
      (player) => player.id === record.playerId
    );
    if (moverIndex < 0) break;

    // History records always identify the mover. Align the turn before
    // replaying so the same reducer path works for local, AI and online games.
    const before = { ...state, currentPlayerIndex: moverIndex };
    const result = applyAction(before, record.action, {
      timestamp: record.timestamp,
    });
    if (!result.success) break;

    const after = result.state;
    if (record.playerId === playerId) {
      counts[classifyMove(before, after, record.action, playerId)] += 1;
    }
    state = after;
  }

  return counts;
}

function shortestFor(state: GameState, player: PlayerState): number {
  return getShortestDistance(
    player.position,
    player.goalDirection,
    state.walls,
    state.mode
  );
}

function closestOpponentDistance(
  state: GameState,
  playerId: string
): number {
  let closest = Infinity;
  for (const opponent of state.players) {
    if (opponent.id === playerId || opponent.status !== 'ACTIVE') continue;
    const distance = shortestFor(state, opponent);
    if (distance < closest) closest = distance;
  }
  return closest;
}

function classifyMove(
  before: GameState,
  after: GameState,
  action: GameAction,
  playerId: string
): MoveAssessment {
  const moverBefore = before.players.find((player) => player.id === playerId);
  if (!moverBefore) return 'FORCED';

  const distanceBefore = shortestFor(before, moverBefore);
  const opponentBefore = closestOpponentDistance(before, playerId);

  if (action.type === 'MOVE') {
    const legalMoves = getLegalMoves(before, playerId);
    let bestDistance = Infinity;
    for (const destination of legalMoves) {
      const distance = getShortestDistance(
        destination,
        moverBefore.goalDirection,
        before.walls,
        before.mode
      );
      if (distance < bestDistance) bestDistance = distance;
    }

    const distanceAfter = getShortestDistance(
      action.to,
      moverBefore.goalDirection,
      before.walls,
      before.mode
    );
    const loss = Math.max(0, distanceAfter - bestDistance);
    const movedBackward = distanceAfter > distanceBefore;

    if (loss <= 0) return 'BEST';
    if (movedBackward) {
      if (loss >= 3) return 'BLUNDER';
      if (loss === 2) return 'MISTAKE';
      return 'INACCURACY';
    }
    if (loss === 1) return 'EXCELLENT';
    if (loss === 2) return 'GOOD';
    if (loss === 3) return 'INACCURACY';
    if (loss === 4) return 'MISTAKE';
    return 'BLUNDER';
  }

  if (action.type === 'PLACE_WALL') {
    const moverAfter = after.players.find((player) => player.id === playerId);
    const distanceAfter = moverAfter
      ? shortestFor(after, moverAfter)
      : distanceBefore;
    const opponentAfter = closestOpponentDistance(after, playerId);

    const ownDetour = Math.max(0, distanceAfter - distanceBefore);
    const opponentDetour = Math.max(0, opponentAfter - opponentBefore);
    const wasBehind = distanceBefore > opponentBefore;
    const wasFarBehind = distanceBefore - opponentBefore >= 2;

    if (ownDetour >= 3) return 'BLUNDER';
    if (ownDetour >= 2) return 'MISTAKE';
    if (ownDetour >= 1) return 'INACCURACY';

    if (opponentDetour >= 5 && wasFarBehind) return 'BRILLIANT';
    if (opponentDetour >= 3) return 'GREAT';
    if (opponentDetour >= 2) return 'EXCELLENT';
    if (opponentDetour >= 1) return 'GOOD';

    // A wall that changes nothing is a wasted resource. If the opponent is
    // already close, call it out; otherwise keep the estimate conservative.
    if (wasBehind && opponentBefore <= 4) return 'MISTAKE';
    return 'INACCURACY';
  }

  return 'FORCED';
}
