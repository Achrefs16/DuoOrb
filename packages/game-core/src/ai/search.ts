import type { GameAction, GameState } from '../types.js';
import type { AIProfile, ScoredCandidate, SearchContext } from './types.js';
import { boardOf, routeOf } from '../ai-structure.js';
import { applyAction } from '../ruleset.js';
import { evaluateState } from './evaluation.js';
import { buildSearchCandidates, orderCandidates } from './candidates.js';
import { computeZobristHash } from './zobrist.js';
import { MOVER_WIN_BAR, TIE_EPSILON, WIN_SCORE } from './constants.js';

const TT_LIMIT = 50000;
const CLOCK_SAMPLE = 32;
const SLICE_MS = 150;
const MIN_SLICE_NODES = 50;

export function newSearchContext(
  state: GameState,
  rootId: string,
  profile: AIProfile,
  timeBudgetMs: number | undefined
): SearchContext {
  const budget = timeBudgetMs ?? profile.timeBudgetMs;
  return {
    profile,
    rootId,
    deadline: budget === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + budget,
    aborted: false,
    nodes: 0,
    tt: new Map(),
    multiplayer: state.players.length > 2,
    rootDepth: 0,
    killers: [],
    sliceStart: 0,
    sliceDeadline: 0,
    suspended: false,
    sealSlots: null,
    deadlineInterval: CLOCK_SAMPLE,
  };
}

export function outOfTime(ctx: SearchContext): boolean {
  if (ctx.aborted) return true;
  if (ctx.deadline === Number.POSITIVE_INFINITY) return false;
  if (ctx.nodes % ctx.deadlineInterval === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

export function sliceExhausted(ctx: SearchContext): boolean {
  if (ctx.aborted || ctx.suspended) return ctx.aborted || ctx.suspended;
  if (ctx.nodes - ctx.sliceStart >= MIN_SLICE_NODES && Date.now() > ctx.sliceDeadline) {
    ctx.suspended = true;
    return true;
  }
  return false;
}

export function beginSlice(ctx: SearchContext): void {
  ctx.suspended = false;
  ctx.sliceStart = ctx.nodes;
  ctx.sliceDeadline = Date.now() + SLICE_MS;
}

function terminalRootScore(state: GameState, rootId: string, ply: number): number {
  const base = evaluateState(state, rootId, {
    difficulty: 'hard',
    depth: 1,
    randomness: 0,
    weights: { pathDifference: 12, wallAdvantage: 1.5, mobility: 0.8, pathways: 0.9, tightness: 1.2, placement: 2 },
    maxCandidateWalls: 8,
    timeBudgetMs: 120,
  });
  const p = Math.max(0, Math.min(ply, 500));
  if (base >= WIN_SCORE) return WIN_SCORE - Math.min(p, WIN_SCORE - 1);
  return base + Math.min(p, -base - 1);
}

function sameGameAction(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'MOVE' && b.type === 'MOVE') {
    return a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL') {
    return (
      a.wall.row === b.wall.row &&
      a.wall.col === b.wall.col &&
      a.wall.orientation === b.wall.orientation
    );
  }
  return true;
}

function storeKiller(ctx: SearchContext, ply: number, action: GameAction): void {
  if (ply < 0) return;
  while (ctx.killers.length <= ply) ctx.killers.push([null, null]);
  const slot = ctx.killers[ply];
  if (!slot) return;
  if (slot[0] !== null && sameGameAction(slot[0], action)) return;
  slot[1] = slot[0];
  slot[0] = action;
}

export function searchNode(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext
): number {
  const ply = Math.max(0, ctx.rootDepth - depth);
  if (depth <= 0 || state.status === 'COMPLETED') {
    if (state.status === 'COMPLETED') return terminalRootScore(state, ctx.rootId, ply);
    return evaluateState(state, ctx.rootId, ctx.profile);
  }
  if (outOfTime(ctx) || sliceExhausted(ctx)) {
    return evaluateState(state, ctx.rootId, ctx.profile);
  }

  // Exact no-wall race (1v1, everyone active)
  if (!ctx.multiplayer && state.status === 'IN_PROGRESS') {
    const all = state.players;
    if (all.length > 0 && all.every((p) => p.status === 'ACTIVE' && p.wallsRemaining <= 0)) {
      const me = state.players[state.currentPlayerIndex];
      const opp = all.find((p) => p.id !== me?.id);
      if (me && opp) {
        const raceBoard = boardOf(state);
        const myDist = routeOf(state, raceBoard, me).distance;
        const oppDist = routeOf(state, raceBoard, opp).distance;
        if (Number.isFinite(myDist) && Number.isFinite(oppDist)) {
          const winnerId = myDist <= oppDist ? me.id : opp.id;
          const winnerDist = myDist <= oppDist ? myDist : oppDist;
          return winnerId === ctx.rootId ? WIN_SCORE - winnerDist : -(WIN_SCORE - winnerDist);
        }
      }
    }
  }

  ctx.nodes++;

  const key = computeZobristHash(state);
  const hit = ctx.tt.get(key);
  let ttMove: GameAction | null | undefined;
  if (hit) {
    ttMove = hit.move;
    if (hit.depth >= depth) {
      if (hit.bound === 0) return hit.value;
      if (hit.bound === 1) {
        if (hit.value >= beta) return hit.value;
        if (hit.value > alpha) alpha = hit.value;
      } else {
        if (hit.value <= alpha) return hit.value;
        if (hit.value < beta) beta = hit.value;
      }
    }
  }

  const mover = state.players[state.currentPlayerIndex];
  if (!mover) return evaluateState(state, ctx.rootId, ctx.profile);
  const board = boardOf(state);
  const own = routeOf(state, board, mover);
  const killers = ctx.killers[ply] ?? [];
  const candidates = orderCandidates(
    buildSearchCandidates(state, board, own, mover.id, ctx.profile, depth, ctx.rootId, ctx.sealSlots),
    ttMove,
    killers
  );
  if (candidates.length === 0) return evaluateState(state, ctx.rootId, ctx.profile);

  let value: number;
  let bound: 0 | 1 | 2 = 0;
  let bestAction: GameAction | null = null;

  if (!ctx.multiplayer) {
    const maximizing = mover.id === ctx.rootId;
    let best = maximizing ? -Infinity : Infinity;
    let cut = false;
    let first = true;
    for (const candidate of candidates) {
      const applied = applyAction(state, candidate.action);
      if (!applied.success) continue;
      let evaluation: number;
      if (first) {
        evaluation = searchNode(applied.state, depth - 1, alpha, beta, ctx);
      } else if (maximizing) {
        evaluation = searchNode(applied.state, depth - 1, alpha, alpha + 1, ctx);
        if (evaluation > alpha && evaluation < beta) {
          evaluation = searchNode(applied.state, depth - 1, evaluation, beta, ctx);
        }
      } else {
        evaluation = searchNode(applied.state, depth - 1, beta - 1, beta, ctx);
        if (evaluation > alpha && evaluation < beta) {
          evaluation = searchNode(applied.state, depth - 1, alpha, evaluation, ctx);
        }
      }
      first = false;
      if (maximizing) {
        if (evaluation > best) {
          best = evaluation;
          bestAction = candidate.action;
        }
        if (best > alpha) alpha = best;
      } else {
        if (evaluation < best) {
          best = evaluation;
          bestAction = candidate.action;
        }
        if (best < beta) beta = best;
      }
      if (beta <= alpha) {
        cut = true;
        storeKiller(ctx, ply, candidate.action);
        break;
      }
      if (ctx.aborted || ctx.suspended) break;
    }
    if (best === -Infinity || best === Infinity) {
      return evaluateState(state, ctx.rootId, ctx.profile);
    }
    value = best;
    bound = cut ? (maximizing ? 1 : 2) : 0;
  } else {
    let bestMover = -Infinity;
    let reported: number | null = null;
    for (const candidate of candidates) {
      const applied = applyAction(state, candidate.action);
      if (!applied.success) continue;
      const rootValue = searchNode(applied.state, depth - 1, -Infinity, Infinity, ctx);
      const moverValue = evaluateState(applied.state, mover.id, ctx.profile);
      if (reported === null || moverValue > bestMover + TIE_EPSILON) {
        bestMover = moverValue;
        reported = rootValue;
        bestAction = candidate.action;
      }
      if (bestMover >= MOVER_WIN_BAR || ctx.aborted || ctx.suspended) break;
    }
    if (reported === null) return evaluateState(state, ctx.rootId, ctx.profile);
    value = reported;
    bound = 0;
  }

  if (!ctx.aborted && !ctx.suspended) {
    if (ctx.tt.size >= TT_LIMIT) ctx.tt.clear();
    ctx.tt.set(key, { depth, value, bound, move: bestAction });
  }
  return value;
}
