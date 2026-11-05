import {
  applyAction,
  botById,
  getBestActionAsync,
  getLegalMoves,
  getShortestDistance,
  isGoalCell,
  isLegalWallPlacement,
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
 * Human-like tactical counter-walling.
 * When a rival places walls against the bot or starts cutting off paths,
 * a real human does not just blindly keep walking forward — they find
 * an effective counter-wall that delays the rival by +2 or more plies.
 */
function findTacticalCounterWall(state: GameState, botPlayerId: string): GameAction | null {
  const me = state.players.find((p) => p.id === botPlayerId);
  if (!me || me.wallsRemaining <= 0 || state.walls.length === 0) return null;
  const rival = state.players.find((p) => p.id !== botPlayerId);
  if (!rival) return null;

  const botDistBefore = distance(state, botPlayerId);
  const rivalDistBefore = distance(state, rival.id);

  // Focus counter-walls when the rival has walled or is running close/ahead
  const rRow = rival.position.row;
  const rCol = rival.position.col;
  const candidates: { row: number; col: number; orientation: 'H' | 'V' }[] = [];

  // 1. Direct block in front of rival
  const frontRow = rival.goalDirection === 'TOP' ? rRow - 1 : rRow;
  if (frontRow >= 0 && frontRow <= 7) {
    candidates.push({ row: frontRow, col: Math.max(0, rCol - 1), orientation: 'H' });
    candidates.push({ row: frontRow, col: Math.min(7, rCol), orientation: 'H' });
  }

  // 2. Vertical corridor traps beside rival
  const vRow = Math.max(0, Math.min(7, rRow - 1));
  candidates.push({ row: vRow, col: Math.max(0, rCol - 1), orientation: 'V' });
  candidates.push({ row: vRow, col: Math.min(7, rCol), orientation: 'V' });

  // 3. Central barrier lines (rows 3, 4, columns 3, 4)
  for (const c of [3, 4, 2, 5]) {
    candidates.push({ row: 3, col: c, orientation: 'H' });
    candidates.push({ row: 4, col: c, orientation: 'H' });
    candidates.push({ row: c, col: 3, orientation: 'V' });
    candidates.push({ row: c, col: 4, orientation: 'V' });
  }

  let bestWall: WallCoord | null = null;
  let maxNetDelay = 0;

  for (const wall of candidates) {
    if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) continue;
    if (!isLegalWallPlacement(state, botPlayerId, wall)) continue;

    const testWalls: WallCoord[] = [
      ...state.walls,
      { ...wall, placedByPlayerId: botPlayerId, sequence: state.history.length + 1 },
    ];
    const rivalDistAfter = distance(state, rival.id, testWalls);
    const botDistAfter = distance(state, botPlayerId, testWalls);

    if (botDistAfter === Infinity || rivalDistAfter === Infinity) continue;

    const delayRival = rivalDistAfter - rivalDistBefore;
    const delayBot = botDistAfter - botDistBefore;
    const netDelay = delayRival - delayBot;

    // Must delay rival by at least 2 steps without hurting self worse
    if (delayRival >= 2 && netDelay > maxNetDelay) {
      maxNetDelay = netDelay;
      bestWall = { row: wall.row, col: wall.col, orientation: wall.orientation };
    }
  }

  return bestWall
    ? { type: 'PLACE_WALL', wall: bestWall }
    : null;
}

/**
 * The single place a computer opponent's move is decided. Order:
 *   1. an immediate win is always taken,
 *   2. obvious pawn sprint (rival has 0 walls or endgame race),
 *   3. tactical counter-wall if rival is playing aggressive walls,
 *   4. the opening plan (first few own moves) when position is unblocked,
 *   5. the game-core engine with the persona's calibrated profile,
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

  // 2. Obvious pawn sprint (opponent has 0 walls remaining, or clean endgame rush)
  const rival = state.players.find((p) => p.id !== botPlayerId);
  const advancing = bestAdvancingMove(state, botPlayerId);
  const current = distance(state, botPlayerId);
  if (rival && rival.wallsRemaining === 0) {
    const rivalDist = distance(state, rival.id);
    if (me.wallsRemaining === 0 || current <= rivalDist) {
      const step = accept(advancing);
      if (step) return step;
    }
  }

  // 3. Opening plan (first few own moves according to signature playstyle).
  if (ctx.openingPlan && ctx.ownMoveIndex < ctx.openingPlan.length) {
    const opened = accept(
      resolveOpeningIntent(state, botPlayerId, ctx.openingPlan[ctx.ownMoveIndex])
    );
    if (opened) return opened;
  }

  // 4. Tactical counter-wall reaction:
  // If rival is placing walls against the bot, respond strategically like a human player
  const rivalWallsPlaced = rival ? (state.mode === '2p' ? 10 : 5) - rival.wallsRemaining : 0;
  if (rival && rivalWallsPlaced > 0 && me.wallsRemaining > 0) {
    const counter = findTacticalCounterWall(state, botPlayerId);
    if (counter) {
      const ok = accept(counter);
      if (ok) return ok;
    }
  }

  // 5. Engine (Native ONNX AlphaZero when available for ONNX bots or hot-streak promotion, else JS MCTS).
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

