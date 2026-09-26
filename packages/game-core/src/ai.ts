import { getLegalMoves } from './movement.js';
import { getPathInfo, getShortestDistance, getShortestPath, isGoalCell } from './pathfinding.js';
import { applyAction } from './ruleset.js';
import { CellCoord, GameAction, GameState, PlayerState, WallCoord } from './types.js';
import { getLegalWalls, isLegalWallPlacement } from './walls.js';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIProfile {
  difficulty: AIDifficulty;
  depth: number;
  randomness: number; // 0..1 weight for jitter
  weights: {
    pathDifference: number; // weight for (opponentDistance - ownDistance)
    wallAdvantage: number;  // weight for (ownWalls - opponentWalls)
    mobility: number;       // number of legal moves
    pathways: number;       // log2 of distinct shortest routes (forks are hard to wall)
  };
  maxCandidateWalls: number; // Wall pruning limit for search performance
  /** Soft ceiling in ms for iterative deepening. The search stops deepening
   *  early rather than blocking a phone's UI thread; always returns the best
   *  action from the last depth that completed. */
  timeBudgetMs: number;
}

export const AI_PROFILES: Record<AIDifficulty, AIProfile> = {
  easy: {
    difficulty: 'easy',
    depth: 1,
    randomness: 0.35,
    weights: {
      pathDifference: 8.0,
      wallAdvantage: 0.5,
      mobility: 0.2,
      pathways: 0.35,
    },
    maxCandidateWalls: 3,
    timeBudgetMs: 20,
  },
  normal: {
    difficulty: 'normal',
    depth: 2,
    randomness: 0.05,
    weights: {
      pathDifference: 10.0,
      wallAdvantage: 1.0,
      mobility: 0.5,
      pathways: 0.6,
    },
    maxCandidateWalls: 5,
    timeBudgetMs: 50,
  },
  hard: {
    difficulty: 'hard',
    depth: 3,
    randomness: 0.0,
    weights: {
      pathDifference: 12.0,
      wallAdvantage: 1.5,
      mobility: 0.8,
      pathways: 0.9,
    },
    maxCandidateWalls: 8,
    timeBudgetMs: 120,
  },
};

/** Terminal score. Large enough that no heuristic can outweigh a finished game. */
const WIN_SCORE = 10000;

/**
 * Static evaluation of a game state from the perspective of activePlayerId.
 * Higher score is better for activePlayerId.
 */
export function evaluateState(state: GameState, activePlayerId: string, profile: AIProfile): number {
  if (state.status === 'COMPLETED') {
    if (state.winnerId === activePlayerId) return WIN_SCORE;
    return -WIN_SCORE;
  }

  const activePlayer = state.players.find((p) => p.id === activePlayerId);
  if (!activePlayer) return 0;

  const opponents = state.players.filter((p) => p.id !== activePlayerId);

  const ownPath = getPathInfo(
    activePlayer.position,
    activePlayer.goalDirection,
    state.walls,
    state.mode
  );
  if (!ownPath) return -WIN_SCORE;
  if (ownPath.distance === 0) return WIN_SCORE;

  // In 2P, opponent distance. In 4P, minimum opponent distance (closest threat)
  let minOpponentDist = Infinity;
  let bestOpponentForks = 0;
  let totalOpponentWalls = 0;

  for (const opp of opponents) {
    const info = getPathInfo(opp.position, opp.goalDirection, state.walls, state.mode);
    if (info && info.distance < minOpponentDist) {
      minOpponentDist = info.distance;
      // Forks are only read off the closest threat, matching minOpponentDist.
      bestOpponentForks = info.pathCount;
    }
    totalOpponentWalls += opp.wallsRemaining;
  }

  const ownDist = ownPath.distance;
  if (ownDist === 0) return WIN_SCORE;

  const avgOpponentWalls = opponents.length > 0 ? totalOpponentWalls / opponents.length : 0;
  const pathAdvantage = minOpponentDist - ownDist;
  const wallAdvantage = activePlayer.wallsRemaining - avgOpponentWalls;

  // Forks: a player with many equal-length routes is very hard to wall down,
  // one on a single corridor is trivially blocked. The plain distance term
  // cannot tell those apart, so it is worth roughly one step of progress at
  // the top of the range. log2 keeps a wide-open board from dominating.
  const pathwayAdvantage =
    Math.log2(1 + Math.min(ownPath.pathCount, PATHWAY_FORK_CAP)) -
    Math.log2(1 + Math.min(bestOpponentForks, PATHWAY_FORK_CAP));

  const ownMobility = getLegalMoves(state, activePlayerId).length;
  let totalOpponentMobility = 0;
  for (const opp of opponents) {
    totalOpponentMobility += getLegalMoves(state, opp.id).length;
  }
  const avgOpponentMobility = opponents.length > 0 ? totalOpponentMobility / opponents.length : 0;
  const mobilityAdvantage = ownMobility - avgOpponentMobility;

  const score =
    pathAdvantage * profile.weights.pathDifference +
    wallAdvantage * profile.weights.wallAdvantage +
    mobilityAdvantage * profile.weights.mobility +
    pathwayAdvantage * profile.weights.pathways;

  return score;
}

/** Forks beyond this contribute nothing extra — one corridor plus one escape is enough. */
const PATHWAY_FORK_CAP = 64;

/**
 * Selects candidate actions for the AI.
 * To keep minimax search fast and intelligent:
 * 1. All pawn moves are evaluated.
 * 2. If walls are available, find walls that lie on/intersect the opponent's current shortest path.
 */
export function getCandidateActions(
  state: GameState,
  playerId: string,
  maxWalls: number
): GameAction[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const actions: GameAction[] = [];

  // 1. All legal pawn moves
  const moves = getLegalMoves(state, playerId);
  for (const to of moves) {
    actions.push({ type: 'MOVE', to });
  }

  // 2. High-impact candidate walls
  if (player.wallsRemaining > 0 && maxWalls > 0) {
    const opponents = state.players.filter((p) => p.id !== playerId);
    const candidateWalls: WallCoord[] = [];

    // Check opponent shortest paths to find wall slots that directly obstruct them
    for (const opp of opponents) {
      const oppPath = getShortestPath(opp.position, opp.goalDirection, state.walls, state.mode);
      if (oppPath && oppPath.length > 0) {
        // Test wall slots along opponent's first few steps (including their
        // current square, so near-goal blocks are discovered too). Neighbors
        // are probed symmetrically (both sides of each step) so mirrored
        // positions evaluate equally — a one-sided probe systematically
        // undervalues half the board.
        const stepsToCheck = oppPath.slice(0, Math.min(5, oppPath.length));
        for (const step of stepsToCheck) {
          const r = Math.min(7, Math.max(0, step.row));
          const c = Math.min(7, Math.max(0, step.col));
          const rPrev = Math.max(0, r - 1);
          const rNext = Math.min(7, r + 1);
          const cPrev = Math.max(0, c - 1);
          const cNext = Math.min(7, c + 1);

          for (const orientation of ['H', 'V'] as const) {
            candidateWalls.push({ row: r, col: c, orientation });
            candidateWalls.push({ row: rPrev, col: c, orientation });
            candidateWalls.push({ row: rNext, col: c, orientation });
            candidateWalls.push({ row: r, col: cPrev, orientation });
            candidateWalls.push({ row: r, col: cNext, orientation });
          }
        }
      }
    }

    // Deduplicate and filter legal walls
    const testedKeys = new Set<string>();
    let wallsAdded = 0;

    for (const w of candidateWalls) {
      const key = `${w.row},${w.col},${w.orientation}`;
      if (testedKeys.has(key)) continue;
      testedKeys.add(key);

      if (isLegalWallPlacement(state, playerId, w)) {
        actions.push({ type: 'PLACE_WALL', wall: w });
        wallsAdded++;
        if (wallsAdded >= maxWalls) break;
      }
    }
  }

  return actions;
}

/**
 * Anti-loop penalty for a candidate destination.
 * Looks back over the player's own recent trail (not just the last step)
 * so wider pace-around cycles are caught too: 6.0 for directly undoing the
 * last move, 3.0 for the square before that, 1.0 for older recent squares,
 * 0 otherwise. Winning moves are never penalized, and a lone legal move is
 * still chosen (it remains the max). This breaks score ties toward progress
 * without overpowering genuinely better moves (a full step is worth ~10).
 */
export function repetitionPenalty(
  state: GameState,
  playerId: string,
  to: CellCoord
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  if (isGoalCell(to, player.goalDirection, state.mode)) return 0;

  // Player's own recent MOVE targets, newest first.
  const recent: CellCoord[] = [];
  for (let i = state.history.length - 1; i >= 0 && recent.length < 6; i--) {
    const h = state.history[i];
    if (h.playerId === playerId && h.action.type === 'MOVE') {
      recent.push(h.action.to);
    }
  }
  // recent[0] is where the player stands now — revisits start at index 1.
  for (let k = 1; k < recent.length; k++) {
    const t = recent[k];
    if (t.row === to.row && t.col === to.col) {
      if (k === 1) return 6;
      if (k === 2) return 3;
      return 1;
    }
  }
  return 0;
}

/**
 * First step of the player's optimal (BFS shortest) path to goal,
 * or null when no path exists. BFS on an unweighted grid is optimal,
 * so this is the "best algorithm" answer for reaching the target.
 */
export function shortestPathStep(state: GameState, playerId: string): CellCoord | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const path = getShortestPath(player.position, player.goalDirection, state.walls, state.mode);
  return path && path.length > 1 ? path[1] : null;
}

/**
 * Search bookkeeping shared by every node of one root search.
 *
 * `deadline` is a wall-clock budget in ms. The search checks it on entry to
 * each node and unwinds via `aborted` rather than running to completion, which
 * is what keeps a slow device from freezing the UI: the caller falls back to
 * the best action from the last depth that finished.
 */
interface SearchContext {
  deadline: number;
  aborted: boolean;
  nodes: number;
}

function makeContext(timeBudgetMs: number | undefined): SearchContext {
  const budget = timeBudgetMs ?? Number.POSITIVE_INFINITY;
  return {
    deadline: budget === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + budget,
    aborted: false,
    nodes: 0,
  };
}

function outOfTime(ctx: SearchContext): boolean {
  if (ctx.aborted) return true;
  if (ctx.deadline === Number.POSITIVE_INFINITY) return false;
  // Checking the clock on every node is itself measurable, so only sample it
  // every 256 nodes.
  if ((ctx.nodes & 0xff) === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

/**
 * Orders candidates so alpha-beta can cut early: the step that actually
 * reduces distance first, then walls by how much delay they buy, then the rest.
 *
 * On an unordered branching factor of ~14 the search visits close to the full
 * tree; ordering is the cheapest large speedup available because it needs no
 * extra search — only one BFS per wall candidate, which is paid back many times
 * over by the pruning.
 */
function orderCandidates(
  entries: Array<{ action: GameAction; delay: number; onPath: boolean }>
): void {
  entries.sort((a, b) => {
    if (a.onPath !== b.onPath) return a.onPath ? -1 : 1;
    if (a.delay !== b.delay) return b.delay - a.delay;
    return 0;
  });
}

/**
 * Minimax with Alpha-Beta pruning to find the best move.
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  rootPlayerId: string,
  profile: AIProfile,
  ctx: SearchContext
): number {
  if (depth === 0 || state.status === 'COMPLETED') {
    return evaluateState(state, rootPlayerId, profile);
  }

  if (outOfTime(ctx)) {
    return evaluateState(state, rootPlayerId, profile);
  }
  ctx.nodes++;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const candidates = getCandidateActions(
    state,
    currentPlayer.id,
    profile.maxCandidateWalls
  );

  if (candidates.length === 0) {
    return evaluateState(state, rootPlayerId, profile);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const action of candidates) {
      const result = applyAction(state, action);
      if (!result.success) continue;

      const nextIsMaximizing =
        result.state.players[result.state.currentPlayerIndex].id === rootPlayerId;

      const evaluation = minimax(
        result.state,
        depth - 1,
        alpha,
        beta,
        nextIsMaximizing,
        rootPlayerId,
        profile,
        ctx
      );

      if (evaluation > maxEval) maxEval = evaluation;
      if (evaluation > alpha) alpha = evaluation;
      if (beta <= alpha) break; // Beta cut-off
      if (ctx.aborted) break;
    }
    return maxEval === -Infinity ? evaluateState(state, rootPlayerId, profile) : maxEval;
  } else {
    let minEval = Infinity;
    for (const action of candidates) {
      const result = applyAction(state, action);
      if (!result.success) continue;

      const nextIsMaximizing =
        result.state.players[result.state.currentPlayerIndex].id === rootPlayerId;

      const evaluation = minimax(
        result.state,
        depth - 1,
        alpha,
        beta,
        nextIsMaximizing,
        rootPlayerId,
        profile,
        ctx
      );

      if (evaluation < minEval) minEval = evaluation;
      if (evaluation < beta) beta = evaluation;
      if (beta <= alpha) break; // Alpha cut-off
      if (ctx.aborted) break;
    }
    return minEval === Infinity ? evaluateState(state, rootPlayerId, profile) : minEval;
  }
}

/**
 * Selects the best action for the current AI player according to its profile.
 */
export function getBestAction(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number
): GameAction | null {
  void randomSeed; // legacy parameter, kept for signature compatibility
  if (state.status !== 'IN_PROGRESS') return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return null;

  // Iterative deepening: search one ply, then two, then three, stopping as
  // soon as a ply would exceed the time budget. The shallower plies are cheap
  // and already far stronger than the previous flat-depth search, so a phone
  // that can only afford depth 2 still plays well — and it returns the
  // completed result rather than a half-finished tree.
  const deadline = Date.now() + profile.timeBudgetMs;

  let fallback: GameAction | null = null;

  for (let depth = 1; depth <= profile.depth; depth++) {
    const started = Date.now();
    const ranked = rankActions(state, currentPlayer.id, profile, {
      depth,
      deterministic: true,
      timeBudgetMs: Math.max(1, deadline - started),
    });
    if (ranked.length === 0) break;

    const best = argmax(ranked);
    fallback = best;
    if (Date.now() >= deadline) break;
  }

  if (!fallback) return null;

  // Jitter is applied to the final choice only, so the search itself stays
  // deterministic and repeatable (and the analysis engine can opt out).
  if (profile.randomness > 0) {
    const ranked = rankActions(state, currentPlayer.id, profile, {
      depth: profile.depth,
      deterministic: true,
      timeBudgetMs: profile.timeBudgetMs,
    });
    if (ranked.length > 0) {
      const jittered = ranked.map((r) => ({
        action: r.action,
        score: r.score + (Math.random() - 0.5) * 2 * profile.randomness * 10,
      }));
      return argmax(jittered);
    }
  }

  return fallback;
}

function argmax(ranked: RankedAction[]): GameAction | null {
  let bestScore = -Infinity;
  let bestActions: GameAction[] = [];

  for (const { action, score } of ranked) {
    if (score > bestScore) {
      bestScore = score;
      bestActions = [action];
    } else if (Math.abs(score - bestScore) < 0.001) {
      bestActions.push(action);
    }
  }

  if (bestActions.length === 0) return null;
  if (bestActions.length === 1) return bestActions[0];
  return bestActions[Math.floor(Math.random() * bestActions.length)];
}

export interface RankedAction {
  action: GameAction;
  score: number;
}

export interface RankOptions {
  /** Search depth override (defaults to the profile depth). */
  depth?: number;
  /** Skip jitter and pick deterministically (for analysis, not play). */
  deterministic?: boolean;
  /**
   * Wall-clock budget in ms. The search returns the best action from the last
   * depth that completed, so a slow device degrades in strength rather than
   * freezing. Defaults to the profile budget.
   */
  timeBudgetMs?: number;
}

/**
 * Scores every candidate action for a player (minimax + profile guidance).
 * Pure and deterministic when `deterministic` is set — used by both play
 * (via getBestAction) and the analysis engine (ranked alternatives, PV).
 */
export function rankActions(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  opts: RankOptions = {}
): RankedAction[] {
  const currentPlayer = state.players.find((p) => p.id === playerId);
  if (!currentPlayer || state.status !== 'IN_PROGRESS') return [];

  const depth = opts.depth ?? profile.depth;
  const candidates = getCandidateActions(
    state,
    currentPlayer.id,
    profile.maxCandidateWalls
  );

  if (candidates.length === 0) return [];

  // Goal-directed guidance, computed once per turn from the optimal paths:
  // - pathStep: the next square along the AI's own shortest route.
  // - racing: AI is strictly closer to goal than every opponent → just run.
  const ownInfo = getPathInfo(
    currentPlayer.position,
    currentPlayer.goalDirection,
    state.walls,
    state.mode
  );
  const pathStep = ownInfo?.firstStep ?? null;
  const ownPathLen = ownInfo ? ownInfo.distance : Infinity;

  // One BFS per opponent, reused by every wall candidate below instead of
  // re-running the same search per candidate.
  const opponentIds = state.players.filter((p) => p.id !== currentPlayer.id).map((p) => p.id);
  const minOppDist = (() => {
    let best = Infinity;
    for (const id of opponentIds) {
      const opp = state.players.find((p) => p.id === id);
      if (!opp) continue;
      const d = getShortestDistance(opp.position, opp.goalDirection, state.walls, state.mode);
      if (d < best) best = d;
    }
    return best;
  })();

  const racing = ownPathLen < minOppDist;
  // Smarter profiles follow the path more strictly; easy stays loose.
  const focus = 1 - profile.randomness;

  // Whether this turn has a productive alternative. Walling only really costs
  // tempo when a step forward was available — when the route ahead is blocked
  // the turn was going to be spent shuffling anyway, so the wall is close to
  // free. Charging a full step unconditionally (an earlier attempt) made every
  // wall look like a clear loss, so the AI either refused to wall at all or,
  // in self-play, both seats walled constantly and the second mover won 100%
  // of games purely because the first was charged tempo for going first.
  const hasProgressMove = (() => {
    if (ownPathLen === Infinity) return false;
    const target = ownPathLen - 1;
    for (const to of getLegalMoves(state, currentPlayer.id)) {
      if (getShortestDistance(to, currentPlayer.goalDirection, state.walls, state.mode) === target) {
        return true;
      }
    }
    return false;
  })();

  const ctx = makeContext(opts.timeBudgetMs);

  type Scored = { action: GameAction; score: number; onPath: boolean; delay: number };
  const scored: Scored[] = [];

  for (const action of candidates) {
    const result = applyAction(state, action);
    if (!result.success) continue;

    const nextIsMaximizing =
      result.state.players[result.state.currentPlayerIndex].id === currentPlayer.id;

    // Search value
    let score = minimax(
      result.state,
      depth - 1,
      -Infinity,
      Infinity,
      nextIsMaximizing,
      currentPlayer.id,
      profile,
      ctx
    );

    // Add slight random jitter based on profile.randomness
    if (!opts.deterministic && profile.randomness > 0) {
      const jitter = (Math.random() - 0.5) * 2 * profile.randomness * 10;
      score += jitter;
    }

    let onPath = false;
    let delay = 0;

    if (action.type === 'MOVE') {
      // Prefer progress over shuffling back and forth. Scaled to a
      // tie-breaker: it must never outweigh a genuine step of progress,
      // because when you are walled in, shuffling is the *correct* play.
      score -= repetitionPenalty(state, currentPlayer.id, action.to) * 0.25;
      // Step along the optimal shortest path when possible.
      if (pathStep && action.to.row === pathStep.row && action.to.col === pathStep.col) {
        score += 4 * focus;
        onPath = true;
      }
      // Winning the race: keep running instead of walling.
      if (racing) score += 3 * focus;
    }

    // Spoil the opponent's plan: walls that lengthen the closest opponent's
    // route, priced in the same currency as everything else.
    //
    // The exchange rate is the whole ballgame. An earlier revision capped the
    // wall bonus at a flat 8 while `chase` scaled it by 0.3, which made the
    // best possible wall worth less than a single step of progress (12 at
    // hard) — so a wall could never be chosen while any forward move existed
    // and the AI degenerated into a pure footrace that never spent a wall.
    if (action.type === 'PLACE_WALL') {
      let after = Infinity;
      for (const id of opponentIds) {
        const opp = result.state.players.find((p) => p.id === id);
        if (!opp) continue;
        const d = getShortestDistance(
          opp.position,
          opp.goalDirection,
          result.state.walls,
          result.state.mode
        );
        if (d < after) after = d;
      }
      delay = Math.max(0, after - minOppDist);

      const perStep = profile.weights.pathDifference;

      // Charge the turn — but only if a forward step was actually available.
      // The leaf evaluation is turn-blind, so the search happily credits a
      // wall for pushing the opponent one step further away without
      // accounting for the step this wall gave up. Without this charge,
      // walling always looks like a small gain over walking.
      if (hasProgressMove) score -= perStep;

      if (delay > 0) {
        // The delay itself is already reflected in the search result above.
        // This is only a horizon correction: at depth 1-2 the search cannot
        // see that a detour keeps compounding over the turns that follow, so
        // a real delay is credited again — but only when it can change the
        // race. Someone about to finish is blocked at full weight; a wall
        // that merely shrinks a deficit is not, because the opponent moves
        // first from here on and the race stays level.
        const emergency = minOppDist <= 1;
        const flipsAhead = ownPathLen < minOppDist + delay;
        const urgency = emergency ? 2.5 : flipsAhead ? 1 : 0.3;
        score += Math.min(perStep * 3, delay * perStep) * urgency * focus;
      }
    }

    scored.push({ action, score, onPath, delay });
  }

  // Best-first ordering for the caller and for the root scan below.
  orderCandidates(scored);
  return scored.map(({ action, score }) => ({ action, score }));
}
