import {
  applyAction,
  botById,
  getBestActionAsync,
  getLegalMoves,
  getShortestDistance,
  isGoalCell,
  type GameAction,
  type GameState,
  type WallCoord,
} from '@duoorb/game-core';
import { resolveOpeningIntent, type OpeningPlan } from './opening-plans.js';
import type { BotPersona } from './bot-roster.js';

let nativeAnalyzer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const req = eval('require');
  nativeAnalyzer = typeof req === 'function' ? req('@duoorb/analyzer-rust') : null;
} catch {
  nativeAnalyzer = null;
}

export interface BotMoveContext {
  persona: BotPersona;
  /** Id of the bot's seat inside the game state (p1, p2, ...). */
  botPlayerId: string;
  seed: number;
  /** The bot's own-move counter for this game (0 = its first move). */
  ownMoveIndex: number;
  openingPlan?: OpeningPlan;
  shouldCancel?: () => boolean;
  /** Dynamically activate the Milo AlphaZero ONNX engine (e.g. against players on hot streaks). */
  forceMilo?: boolean;
}

const MOVE_BUDGET = { timeMs: 200, maxDepth: 4 } as const;

function distance(state: GameState, playerId: string, walls: WallCoord[] = state.walls): number {
  const p = state.players.find((x) => x.id === playerId);
  return p ? getShortestDistance(p.position, p.goalDirection, walls, state.mode) : Infinity;
}

function bestAdvancingMove(state: GameState, playerId: string): GameAction | null {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;
  const current = distance(state, playerId);
  let best: { to: { row: number; col: number }; dist: number } | null = null;
  for (const to of getLegalMoves(state, playerId)) {
    const dist = getShortestDistance(to, me.goalDirection, state.walls, state.mode);
    if (dist < current && (!best || dist < best.dist)) best = { to, dist };
  }
  return best ? { type: 'MOVE', to: best.to } : null;
}

function anyLegalMove(state: GameState, playerId: string): GameAction | null {
  const moves = getLegalMoves(state, playerId);
  if (moves.length === 0) return null;
  const me = state.players.find((p) => p.id === playerId)!;
  let best = moves[0];
  let bestDist = getShortestDistance(best, me.goalDirection, state.walls, state.mode);
  for (const to of moves) {
    const dist = getShortestDistance(to, me.goalDirection, state.walls, state.mode);
    if (dist < bestDist) {
      best = to;
      bestDist = dist;
    }
  }
  return { type: 'MOVE', to: best };
}

function isWinningMove(state: GameState, playerId: string, action: GameAction): boolean {
  if (action.type !== 'MOVE') return false;
  const me = state.players.find((p) => p.id === playerId);
  return !!me && isGoalCell(action.to, me.goalDirection, state.mode);
}

/** Does this wall delay at least one opponent? Useless walls are never played. */
function wallDelaysRival(state: GameState, playerId: string, wall: WallCoord): boolean {
  const withWall: WallCoord[] = [...state.walls, wall];
  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
    const before = getShortestDistance(rival.position, rival.goalDirection, state.walls, state.mode);
    const after = getShortestDistance(rival.position, rival.goalDirection, withWall, state.mode);
    if (after > before) return true;
  }
  return false;
}

/**
 * The single place a computer opponent's move is decided. Order:
 *   1. an immediate win is always taken,
 *   2. the opening plan (first few own moves) when it fits the position,
 *   3. the game-core engine with the persona's calibrated profile,
 * and the result is sanity-checked so it can never be a retreat while a
 * forward step exists, a wall that delays nobody, or an illegal action.
 */
export async function chooseBotAction(
  state: GameState,
  ctx: BotMoveContext
): Promise<GameAction | null> {
  if (state.status !== 'IN_PROGRESS') return null;
  const { botPlayerId } = ctx;
  const me = state.players.find((p) => p.id === botPlayerId);
  if (!me || state.players[state.currentPlayerIndex]?.id !== botPlayerId) return null;

  const accept = (action: GameAction | null): GameAction | null => {
    if (!action) return null;
    return applyAction(state, action).success ? action : null;
  };

  // 1. Win now.
  for (const to of getLegalMoves(state, botPlayerId)) {
    const win: GameAction = { type: 'MOVE', to };
    if (isWinningMove(state, botPlayerId, win)) {
      const ok = accept(win);
      if (ok) return ok;
    }
  }

  // 2. Opening plan.
  if (ctx.openingPlan && ctx.ownMoveIndex < ctx.openingPlan.length) {
    const opened = accept(
      resolveOpeningIntent(state, botPlayerId, ctx.openingPlan[ctx.ownMoveIndex])
    );
    if (opened) return opened;
  }

  // 3. Engine (Native ONNX AlphaZero when available for ONNX bots or hot-streak promotion, else JS MCTS).
  let action: GameAction | null = null;
  const useOnnx = Boolean(ctx.forceMilo || ctx.persona.useOnnx);
  const targetEngineBotId = ctx.forceMilo ? 'milo' : (ctx.persona.engineBotId || 'milo');
  if (useOnnx && nativeAnalyzer && typeof nativeAnalyzer.getBotActionAsync === 'function' && !ctx.shouldCancel?.()) {
    try {
      action = await nativeAnalyzer.getBotActionAsync(
        state,
        targetEngineBotId,
        null,
        ctx.seed
      );
    } catch {
      action = null;
    }
  }

  if (!action) {
    const fallbackId = ctx.forceMilo ? 'milo' : ctx.persona.engineBotId;
    const profile = botById(fallbackId)?.profile;
    if (profile) {
      try {
        action = await getBestActionAsync(state, profile, ctx.seed, {
          budget: MOVE_BUDGET,
          shouldCancel: ctx.shouldCancel,
        });
      } catch {
        action = null;
      }
    }
  }
  if (ctx.shouldCancel?.()) return null;

  const current = distance(state, botPlayerId);
  const advancing = bestAdvancingMove(state, botPlayerId);

  if (action?.type === 'MOVE') {
    const next = getShortestDistance(action.to, me.goalDirection, state.walls, state.mode);
    // Never retreat or step into a closed pocket while a forward step exists.
    if ((next < 0 || next > current) && advancing) action = advancing;
  } else if (action?.type === 'PLACE_WALL') {
    // Never spend a wall that delays nobody.
    if (!wallDelaysRival(state, botPlayerId, {
      ...action.wall,
      placedByPlayerId: botPlayerId,
      sequence: state.history.length + 1,
    } as WallCoord) && advancing) {
      action = advancing;
    }
  } else if (!action) {
    action = advancing ?? anyLegalMove(state, botPlayerId);
  }

  return accept(action) ?? accept(advancing) ?? accept(anyLegalMove(state, botPlayerId));
}

