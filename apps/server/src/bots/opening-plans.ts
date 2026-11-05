import {
  getLegalMoves,
  getShortestDistance,
  isLegalMove,
  isLegalWallPlacement,
  type GameAction,
  type GameState,
  type WallCoord,
} from '@duoorb/game-core';

/**
 * Opening variety without 100 hand-written scripts.
 *
 * An opening plan is a short list of INTENTS the bot tries on its own first
 * moves. Intents are resolved against the live position every time, so a plan
 * can never produce an illegal move or a blunder: each intent is validated and,
 * if it does not fit the board (or would cost real strength), it is skipped and
 * the engine plays that move instead.
 *
 *   A   advance along a shortest path
 *   L/R sidestep one column left/right without losing distance
 *   WF/WR/WV  an early wall: in front of the rival (shifted left/right) or
 *             beside it. Only played when it genuinely delays the rival.
 */
export type OpeningIntent = 'A' | 'L' | 'R' | 'WF' | 'WR' | 'WV';
export type OpeningPlan = readonly OpeningIntent[];

const PLAN_LENGTH = 5;

function buildPlans(): OpeningPlan[] {
  const intents: OpeningIntent[] = ['A', 'L', 'R', 'WF', 'WR', 'WV'];
  const isSide = (i: OpeningIntent) => i === 'L' || i === 'R';
  const isWall = (i: OpeningIntent) => i === 'WF' || i === 'WR' || i === 'WV';
  const plans: OpeningPlan[] = [];

  const walk = (prefix: OpeningIntent[]): void => {
    if (prefix.length === PLAN_LENGTH) {
      plans.push(prefix);
      return;
    }
    for (const next of intents) {
      const sides = prefix.filter(isSide).length + (isSide(next) ? 1 : 0);
      const walls = prefix.filter(isWall).length + (isWall(next) ? 1 : 0);
      if (sides > 1 || walls > 1) continue;
      // Never open with a wall; walls only from the third own move on.
      if (isWall(next) && prefix.length < 2) continue;
      walk([...prefix, next]);
    }
  };
  walk([]);
  return plans;
}

/** ~90 distinct deterministic plans. */
export const OPENING_PLANS: readonly OpeningPlan[] = buildPlans();

/** Plans without sidesteps, for strong personas that should not waste tempo. */
export const STRONG_OPENING_PLANS: readonly OpeningPlan[] = OPENING_PLANS.filter(
  (plan) => !plan.includes('L') && !plan.includes('R')
);

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a plan for one game. `recentPlanIds` are the plans this user has just
 * faced; they are excluded so consecutive games never open the same way.
 */
export function pickOpeningPlan(
  userId: string,
  gameId: string,
  strong: boolean,
  recentPlanIds: readonly number[]
): { id: number; plan: OpeningPlan } {
  const pool = strong ? STRONG_OPENING_PLANS : OPENING_PLANS;
  const recent = new Set(recentPlanIds);
  const indices: number[] = [];
  pool.forEach((plan, idx) => {
    if (!recent.has(globalPlanId(plan))) indices.push(idx);
  });
  const usable = indices.length > 0 ? indices : pool.map((_, idx) => idx);
  const chosen = pool[usable[hash32(`${userId}|${gameId}`) % usable.length]];
  return { id: globalPlanId(chosen), plan: chosen };
}

function globalPlanId(plan: OpeningPlan): number {
  return OPENING_PLANS.findIndex((candidate) => candidate === plan);
}

function distanceOf(
  state: GameState,
  playerId: string,
  walls: WallCoord[] = state.walls
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return Infinity;
  return getShortestDistance(player.position, player.goalDirection, walls, state.mode);
}

/**
 * Resolve one intent to a concrete, legal, non-harmful action, or null when
 * the position does not fit (caller falls back to the engine).
 */
export function resolveOpeningIntent(
  state: GameState,
  botPlayerId: string,
  intent: OpeningIntent
): GameAction | null {
  const bot = state.players.find((p) => p.id === botPlayerId);
  if (!bot || state.players.length !== 2) return null;
  const rival = state.players.find((p) => p.id !== botPlayerId);
  if (!rival) return null;
  const current = distanceOf(state, botPlayerId);

  if (intent === 'A') {
    let best: { to: { row: number; col: number }; dist: number } | null = null;
    for (const to of getLegalMoves(state, botPlayerId)) {
      const dist = getShortestDistance(to, bot.goalDirection, state.walls, state.mode);
      if (dist < current && (!best || dist < best.dist)) best = { to, dist };
    }
    return best ? { type: 'MOVE', to: best.to } : null;
  }

  if (intent === 'L' || intent === 'R') {
    const to = { row: bot.position.row, col: bot.position.col + (intent === 'L' ? -1 : 1) };
    if (!isLegalMove(state, botPlayerId, to)) return null;
    const dist = getShortestDistance(to, bot.goalDirection, state.walls, state.mode);
    return dist <= current ? { type: 'MOVE', to } : null;
  }

  // Walls: aimed at the rival pawn, direction-aware.
  const rivalForward = rival.goalDirection;
  const rr = rival.position.row;
  const rc = rival.position.col;
  const candidates: WallCoord[] = [];
  if (intent === 'WF' || intent === 'WR') {
    const frontRow =
      rivalForward === 'TOP' ? rr - 1 : rivalForward === 'BOTTOM' ? rr : null;
    if (frontRow === null) return null;
    const col = intent === 'WF' ? rc - 1 : rc;
    candidates.push({ row: frontRow, col, orientation: 'H' });
  } else {
    // WV: vertical wall beside the rival, between its row and the next.
    const row = rivalForward === 'TOP' ? rr - 1 : rr;
    candidates.push({ row, col: rc, orientation: 'V' }, { row, col: rc - 1, orientation: 'V' });
  }

  const rivalBefore = distanceOf(state, rival.id);
  for (const wall of candidates) {
    if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) continue;
    if (!isLegalWallPlacement(state, botPlayerId, wall)) continue;
    const rivalAfter = distanceOf(state, rival.id, [
      ...state.walls,
      { ...wall, placedByPlayerId: botPlayerId, sequence: state.history.length + 1 },
    ]);
    const botAfter = distanceOf(state, botPlayerId, [
      ...state.walls,
      { ...wall, placedByPlayerId: botPlayerId, sequence: state.history.length + 1 },
    ]);
    // Must genuinely delay the rival and must not hurt the bot.
    if (rivalAfter > rivalBefore && botAfter <= current) {
      return { type: 'PLACE_WALL', wall };
    }
  }
  return null;
}

