import type { GameAction, GameMode, GameState } from '../types.js';
import type {
  AIProfile,
  AiProductionBudget,
  AiSearchStats,
  AiWallTuning,
  AsyncSearchHooks,
  RankedAction,
} from './types.js';
import {
  beginEpoch,
  boardOf,
  routeOf,
  type BoardStructure,
} from '../ai-structure.js';
import {
  readStrategicState,
  readAttackBlueprint,
  forecastSeal,
  resetAttackMemo,
  resetFragilityMemo,
  resetStrategicMemo,
} from '../ai-threat.js';
import { resetMobilityMemo } from './evaluation.js';
import { buildRootCandidates } from './candidates.js';
import {
  AI_PROFILES,
  STRATEGIC_EXTRA_DEPTH,
  TIE_EPSILON,
  WIN_SCORE,
} from './constants.js';
import {
  lastSearchNodes,
  lastSearchTruncated,
  rankActions,
} from './ranking.js';
import { beginSlice, newSearchContext } from './search.js';
import { readTacticalState, rivalPressureOnMe } from './tactics.js';

const MULTIPLAYER_BASE_DEPTH = 3;
const MULTIPLAYER_DEPTH_LIMIT = 4;
const HEAD_TO_HEAD_DEPTH_LIMIT = 7;
const BUDGET_MARGIN = 0.94;
const RESCUE_BAR = -WIN_SCORE / 2;

export function productionBudget(
  profile: AIProfile,
  mode: GameMode
): AiProductionBudget {
  const multiplayer = mode !== '2p';
  switch (profile.difficulty) {
    case 'easy':
      return multiplayer ? { timeMs: 60, maxDepth: 2 } : { timeMs: 60, maxDepth: 3 };
    case 'normal':
      return multiplayer ? { timeMs: 130, maxDepth: 3 } : { timeMs: 130, maxDepth: 5 };
    default:
      return multiplayer ? { timeMs: 240, maxDepth: 4 } : { timeMs: 240, maxDepth: 7 };
  }
}

export function aiBudgetNotes(): { basis: string; pending: string } {
  return {
    basis: 'dev-machine worst case per difficulty across all 7 modes; clock never binding (0% truncation)',
    pending: 'confirm on a physical mid-range Android device before shipping',
  };
}

let lastSearchStats: AiSearchStats = {
  depthReached: 0,
  depthRequested: 0,
  truncated: false,
  nodes: 0,
  elapsedMs: 0,
};

export function searchStats(): AiSearchStats {
  return lastSearchStats;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function positionSeed(state: GameState, playerIndex: number): number {
  const board = boardOf(state);
  let hash = 2166136261;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  };
  feed(board.key);
  feed(
    `|${state.currentPlayerIndex}|${playerIndex}|${state.moveNumber}|${
      state.players[playerIndex]?.wallsRemaining ?? 0
    }|${state.history.length}`
  );
  return hash >>> 0;
}

function pickBest(
  ranked: RankedAction[],
  profile: AIProfile,
  rng: () => number
): GameAction | null {
  if (ranked.length === 0) return null;
  if (profile.randomness <= 0) return ranked[0].action;
  const span = profile.randomness * 10;
  let bestScore = -Infinity;
  let winner: GameAction | null = null;
  for (const entry of ranked) {
    const jittered = entry.score + (rng() - 0.5) * 2 * span;
    if (winner === null || jittered > bestScore + TIE_EPSILON) {
      bestScore = jittered;
      winner = entry.action;
    }
  }
  return winner;
}

export function rescueChoice(ranked: RankedAction[]): GameAction | null {
  if (ranked.length === 0 || ranked[0].score > RESCUE_BAR) return null;
  let best: RankedAction | null = null;
  for (const entry of ranked) {
    if (entry.action.type !== 'MOVE' || !entry.progress) continue;
    if (!best || entry.score > best.score + TIE_EPSILON) best = entry;
  }
  return best ? best.action : null;
}

function nearestRivalDistance(
  board: BoardStructure,
  state: GameState,
  playerId: string,
  fallback: number
): number {
  let best = Infinity;
  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess && route.distance < best) best = route.distance;
  }
  return best === Infinity ? fallback : best;
}

export function getBestAction(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number,
  budget?: AiProductionBudget,
  tuning?: Partial<AiWallTuning>
): GameAction | null {
  const callStarted = Date.now();
  lastSearchStats = {
    depthReached: 0,
    depthRequested: 0,
    truncated: false,
    nodes: 0,
    elapsedMs: 0,
  };
  if (state.status !== 'IN_PROGRESS') {
    lastSearchStats.elapsedMs = Date.now() - callStarted;
    return null;
  }
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    lastSearchStats.elapsedMs = Date.now() - callStarted;
    return null;
  }

  const tactical = readTacticalState(state, currentPlayer.id);
  const multiplayer = state.players.length > 2;
  const production = budget ?? productionBudget(profile, state.mode);
  const baseDepth = multiplayer ? Math.min(profile.depth, MULTIPLAYER_BASE_DEPTH) : profile.depth;
  const limit = Math.min(multiplayer ? MULTIPLAYER_DEPTH_LIMIT : HEAD_TO_HEAD_DEPTH_LIMIT, production.maxDepth);
  const promisedDepth = Math.max(1, Math.min(baseDepth, limit));
  const maxDepth = Math.max(promisedDepth, Math.min(baseDepth + tactical.extraDepth, limit));
  lastSearchStats.depthRequested = maxDepth;
  const rng = makeRng(randomSeed ?? positionSeed(state, currentPlayer.index));

  const deadline = Date.now() + Math.max(1, Math.floor(production.timeMs * BUDGET_MARGIN));

  beginEpoch();
  resetMobilityMemo();
  resetStrategicMemo();
  resetAttackMemo();
  resetFragilityMemo();
  const rootBoard = boardOf(state);
  const rootRoute = routeOf(state, rootBoard, currentPlayer);
  const strategic = readStrategicState(
    state,
    currentPlayer.id,
    nearestRivalDistance(rootBoard, state, currentPlayer.id, rootRoute.distance)
  );
  const attack = readAttackBlueprint(state, currentPlayer);
  // Seal forecast for candidate generation only: the seal-breaker scan needs
  // it, and ranking re-derives its own for scoring, so this instance is
  // never used to score — generation and scoring stay independent.
  const sealForCandidates = forecastSeal(
    state,
    currentPlayer,
    rootRoute.distance,
    strategic,
    rivalPressureOnMe(state, currentPlayer.id)
  );
  const rootCandidates = buildRootCandidates(
    state,
    rootBoard,
    rootRoute,
    currentPlayer.id,
    profile,
    tactical,
    deadline,
    strategic,
    attack,
    sealForCandidates
  );

  let fallback: GameAction | null = null;
  let lastRanked: RankedAction[] = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const started = Date.now();
    const ranked = rankActions(state, currentPlayer.id, profile, {
      depth,
      deterministic: true,
      tactical,
      rng,
      timeBudgetMs: Math.max(1, deadline - started),
      candidates: rootCandidates,
      strategic,
      attack,
      tuning,
    });
    if (ranked.length === 0) break;
    lastRanked = ranked;

    const best = pickBest(ranked, profile, rng);
    if (!best) break;
    fallback = best;
    if (!lastSearchTruncated) lastSearchStats.depthReached = depth;
    if (lastSearchTruncated) break;
    if (Date.now() >= deadline) break;
    if (Date.now() - started > deadline - Date.now()) break;
  }
  lastSearchStats.nodes = lastSearchNodes;
  if (lastSearchStats.depthReached < promisedDepth) lastSearchStats.truncated = true;

  const rescued = rescueChoice(lastRanked);
  if (rescued) fallback = rescued;

  lastSearchStats.elapsedMs = Date.now() - callStarted;
  return fallback;
}

export async function getBestActionAsync(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number,
  hooks: AsyncSearchHooks = {}
): Promise<GameAction | null> {
  const callStarted = Date.now();
  lastSearchStats = {
    depthReached: 0,
    depthRequested: 0,
    truncated: false,
    nodes: 0,
    elapsedMs: 0,
  };
  const finish = (action: GameAction | null): GameAction | null => {
    lastSearchStats.nodes = lastSearchNodes;
    lastSearchStats.elapsedMs = Date.now() - callStarted;
    return action;
  };
  if (state.status !== 'IN_PROGRESS') return finish(null);
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return finish(null);

  const tactical = readTacticalState(state, currentPlayer.id);
  const multiplayer = state.players.length > 2;
  const production = hooks.budget;
  const baseDepth = multiplayer ? Math.min(profile.depth, MULTIPLAYER_BASE_DEPTH) : profile.depth;
  const hardLimit = multiplayer ? MULTIPLAYER_DEPTH_LIMIT : HEAD_TO_HEAD_DEPTH_LIMIT;
  const limit = production ? Math.min(hardLimit, production.maxDepth) : hardLimit;
  const promisedDepth = Math.max(1, Math.min(baseDepth, limit));
  lastSearchStats.depthRequested = Math.max(
    promisedDepth,
    Math.min(baseDepth + tactical.extraDepth, limit)
  );
  const rng = makeRng(randomSeed ?? positionSeed(state, currentPlayer.index));

  const ctx = newSearchContext(
    state,
    currentPlayer.id,
    profile,
    production ? Date.now() + Math.max(1, Math.floor(production.timeMs * BUDGET_MARGIN)) : Number.POSITIVE_INFINITY
  );
  beginEpoch();
  resetMobilityMemo();
  resetStrategicMemo();
  resetAttackMemo();
  resetFragilityMemo();
  const rootBoard = boardOf(state);
  const rootRoute = routeOf(state, rootBoard, currentPlayer);
  const strategic = readStrategicState(
    state,
    currentPlayer.id,
    nearestRivalDistance(rootBoard, state, currentPlayer.id, rootRoute.distance)
  );
  const attack = readAttackBlueprint(state, currentPlayer);
  const sealForCandidates = forecastSeal(
    state,
    currentPlayer,
    rootRoute.distance,
    strategic,
    rivalPressureOnMe(state, currentPlayer.id)
  );
  const extraDepth = tactical.extraDepth + (strategic.urgent ? STRATEGIC_EXTRA_DEPTH : 0);
  const maxDepth =
    hooks.maxDepth ?? Math.max(promisedDepth, Math.min(baseDepth + extraDepth, limit));
  lastSearchStats.depthRequested = maxDepth;
  const rootCandidates = buildRootCandidates(
    state,
    rootBoard,
    rootRoute,
    currentPlayer.id,
    profile,
    tactical,
    production ? ctx.deadline : Number.POSITIVE_INFINITY,
    strategic,
    attack,
    sealForCandidates
  );

  let fallback: GameAction | null = null;
  let lastRanked: RankedAction[] = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (hooks.shouldCancel?.()) {
      ctx.aborted = true;
      break;
    }
    for (;;) {
      beginSlice(ctx);
      const ranked = rankActions(state, currentPlayer.id, profile, {
        depth,
        deterministic: true,
        tactical,
        rng,
        timeBudgetMs: Number.POSITIVE_INFINITY,
        candidates: rootCandidates,
        ctx,
        strategic,
        attack,
      });
      if (ranked.length > 0) {
        lastRanked = ranked;
        const best = pickBest(ranked, profile, rng);
        if (best) fallback = best;
      }
      if (!ctx.suspended || ctx.aborted) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (ctx.aborted) break;
    if (!lastSearchTruncated) {
      lastSearchStats.depthReached = depth;
      hooks.onDepth?.({ ...lastSearchStats, nodes: lastSearchNodes });
    }
  }

  const rescued = rescueChoice(lastRanked);
  if (rescued) fallback = rescued;

  return finish(fallback);
}
