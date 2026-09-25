import { getLegalMoves } from './movement.js';
import { getShortestDistance, getShortestPath, isGoalCell } from './pathfinding.js';
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
  };
  maxCandidateWalls: number; // Wall pruning limit for search performance
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
    },
    maxCandidateWalls: 3,
  },
  normal: {
    difficulty: 'normal',
    depth: 2,
    randomness: 0.05,
    weights: {
      pathDifference: 10.0,
      wallAdvantage: 1.0,
      mobility: 0.5,
    },
    maxCandidateWalls: 6,
  },
  hard: {
    difficulty: 'hard',
    depth: 3,
    randomness: 0.0,
    weights: {
      pathDifference: 12.0,
      wallAdvantage: 1.5,
      mobility: 0.8,
    },
    maxCandidateWalls: 10,
  },
};

/**
 * Static evaluation of a game state from the perspective of activePlayerId.
 * Higher score is better for activePlayerId.
 */
export function evaluateState(state: GameState, activePlayerId: string, profile: AIProfile): number {
  if (state.status === 'COMPLETED') {
    if (state.winnerId === activePlayerId) return 10000;
    return -10000;
  }

  const activePlayer = state.players.find((p) => p.id === activePlayerId);
  if (!activePlayer) return 0;

  const opponents = state.players.filter((p) => p.id !== activePlayerId);

  const ownDist = getShortestDistance(activePlayer.position, activePlayer.goalDirection, state.walls, state.mode);
  if (ownDist === 0) return 10000;

  // In 2P, opponent distance. In 4P, minimum opponent distance (closest threat)
  let minOpponentDist = Infinity;
  let totalOpponentWalls = 0;

  for (const opp of opponents) {
    const d = getShortestDistance(opp.position, opp.goalDirection, state.walls, state.mode);
    if (d < minOpponentDist) {
      minOpponentDist = d;
    }
    totalOpponentWalls += opp.wallsRemaining;
  }

  const avgOpponentWalls = opponents.length > 0 ? totalOpponentWalls / opponents.length : 0;
  const pathAdvantage = minOpponentDist - ownDist;
  const wallAdvantage = activePlayer.wallsRemaining - avgOpponentWalls;

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
    mobilityAdvantage * profile.weights.mobility;

  return score;
}

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
 * Minimax with Alpha-Beta pruning to find the best move.
 */
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  rootPlayerId: string,
  profile: AIProfile
): number {
  if (depth === 0 || state.status === 'COMPLETED') {
    return evaluateState(state, rootPlayerId, profile);
  }

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
        profile
      );

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Beta cut-off
    }
    return maxEval;
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
        profile
      );

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Alpha cut-off
    }
    return minEval;
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
  const ranked = rankActions(state, currentPlayer.id, profile);

  if (ranked.length === 0) return null;

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

  // Pick from tied best actions
  const index = Math.floor(Math.random() * bestActions.length);
  return bestActions[index];
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
  const pathStep = shortestPathStep(state, currentPlayer.id);
  const ownPathLen = (() => {
    const p = getShortestPath(
      currentPlayer.position,
      currentPlayer.goalDirection,
      state.walls,
      state.mode
    );
    return p ? p.length - 1 : Infinity;
  })();
  let minOppDist = Infinity;
  for (const opp of state.players) {
    if (opp.id === currentPlayer.id) continue;
    const d = getShortestDistance(opp.position, opp.goalDirection, state.walls, state.mode);
    if (d < minOppDist) minOppDist = d;
  }
  const racing = ownPathLen < minOppDist;
  // Smarter profiles follow the path more strictly; easy stays loose.
  const focus = 1 - profile.randomness;

  const ranked: RankedAction[] = [];

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
      profile
    );

    // Add slight random jitter based on profile.randomness
    if (!opts.deterministic && profile.randomness > 0) {
      const jitter = (Math.random() - 0.5) * 2 * profile.randomness * 10;
      score += jitter;
    }

    // Prefer progress over shuffling back and forth.
    if (action.type === 'MOVE') {
      score -= repetitionPenalty(state, currentPlayer.id, action.to);
      // Step along the optimal shortest path when possible.
      if (
        pathStep &&
        action.to.row === pathStep.row &&
        action.to.col === pathStep.col
      ) {
        score += 4 * focus;
      }
      // Winning the race: keep running instead of walling.
      if (racing) score += 3 * focus;
    }

    // Spoil the opponent's plan: reward walls that lengthen the closest
    // opponent's route. This is how the AI breaks a corridor you started
    // building instead of letting you funnel it. Capped so that stopping
    // you can never dwarf the AI's own race to the line — everything is
    // scored in the same "steps" currency as the path weights. And when
    // clearly losing the race, the AI runs its own route instead of
    // throwing walls it can't afford.
    if (action.type === 'PLACE_WALL') {
      let after = Infinity;
      for (const opp of result.state.players) {
        if (opp.id === currentPlayer.id) continue;
        const d = getShortestDistance(
          opp.position,
          opp.goalDirection,
          result.state.walls,
          result.state.mode
        );
        if (d < after) after = d;
      }
      if (after > minOppDist) {
        const deficit = ownPathLen - minOppDist;
        // Someone about to win: block at full weight no matter what.
        // Clearly losing otherwise: run your own race instead.
        const chase = minOppDist <= 1 || deficit <= 2 ? 1 : 0.3;
        score += Math.min(8, 6 * (after - minOppDist)) * focus * chase;
      }
    }

    ranked.push({ action, score });
  }

  return ranked;
}
