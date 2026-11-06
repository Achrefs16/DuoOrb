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
 * When a rival places walls against the bot or starts cutting off paths (e.g. building a box trap),
 * a real human does not just blindly keep walking forward into the trap — they find
 * an effective counter-wall that delays the rival by +2 or more plies, punishing the rival's tempo.
 */
function findTacticalCounterWall(
  state: GameState,
  botPlayerId: string,
  persona?: BotPersona
): GameAction | null {
  const me = state.players.find((p) => p.id === botPlayerId);
  if (!me || me.wallsRemaining <= 0 || state.walls.length === 0) return null;
  const rival = state.players.find((p) => p.id !== botPlayerId);
  if (!rival) return null;

  const botDistBefore = distance(state, botPlayerId);
  const rivalDistBefore = distance(state, rival.id);

  let bestWall: WallCoord | null = null;
  let maxScore = -Infinity;

  const playstyle = persona?.playstyle;
  const isCounter = playstyle === 'counter';
  const isEarlyWall = playstyle === 'early_wall';

  // Evaluate all legal wall placements across the board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      for (const orientation of ['H', 'V'] as const) {
        const wall: WallCoord = { row: r, col: c, orientation };
        if (!isLegalWallPlacement(state, botPlayerId, wall)) continue;

        // Never place useless counter-walls behind self or far away from the rival
        const isBehindBot = me.goalDirection === 'BOTTOM'
          ? r <= me.position.row
          : me.goalDirection === 'TOP'
          ? r >= me.position.row
          : false;
        if (isBehindBot) continue;

        // Counter-walls must contest the rival or the contested center (within 4.5 cells of rival)
        const distToRival = Math.hypot(r + 0.5 - rival.position.row, c + 0.5 - rival.position.col);
        if (distToRival > 4.5) continue;

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

        // Never accept self-harm unless delaying rival by strictly more
        if (delayBot > 0 && delayRival <= delayBot) continue;

        // Must inflict real delay on the rival without hurting self:
        // delayRival >= 1 and delayBot <= 0 (or netDelay > 0)
        if (delayRival >= 1 && delayBot <= 0) {
          let score = netDelay * 12 + delayRival * 6;

          // Personality style bonuses
          if (persona?.wallStyle === 'horizontal_barricade' && orientation === 'H') score += 6;
          if (persona?.wallStyle === 'vertical_corridor' && orientation === 'V') score += 6;
          if (isCounter) score += 10;
          if (isEarlyWall) score += 8;

          // Bonus for direct front block in front of rival's pawn
          const frontRow = rival.goalDirection === 'TOP' ? rival.position.row - 1 : rival.position.row;
          if (orientation === 'H' && r === frontRow && Math.abs(c - rival.position.col) <= 1) {
            score += 20;
          }

          if (score > maxScore) {
            maxScore = score;
            bestWall = { row: wall.row, col: wall.col, orientation: wall.orientation };
          }
        }
      }
    }
  }

  return bestWall ? { type: 'PLACE_WALL', wall: bestWall } : null;
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

  // 3. Signature Opening Plan (moves 0..4 when openingPlan is provided and unblocked)
  if (ctx.openingPlan && ctx.ownMoveIndex < ctx.openingPlan.length) {
    const intent = ctx.openingPlan[ctx.ownMoveIndex];
    if (intent) {
      const planAction = resolveOpeningIntent(state, botPlayerId, intent);
      if (planAction) {
        const validated = accept(planAction);
        if (validated) {
          // If it's a wall, verify it does not trap self
          if (validated.type === 'PLACE_WALL') {
            const testWalls: WallCoord[] = [
              ...state.walls,
              { ...validated.wall, placedByPlayerId: botPlayerId, sequence: state.history.length + 1 },
            ];
            const myDistAfter = distance(state, botPlayerId, testWalls);
            if (myDistAfter !== Infinity) {
              return validated;
            }
          } else {
            return validated;
          }
        }
      }
    }
  }

  // 4. Tactical Counter-Walling against aggressive opponent walling / box construction:
  // When rival is actively spending walls (building a box or corridor trap),
  // a real human player does not keep walking blindly forward into the funnel —
  // they punish the rival's tempo by finding an effective counter-wall that delays
  // the rival by +2 or more plies, or seals off the rival's exit.
  const rivalWallsPlaced = rival ? (10 - rival.wallsRemaining) : 0;
  const isBoxBuildingRival = rivalWallsPlaced >= 2;
  const isCounterPersona = ctx.persona?.playstyle === 'counter' || ctx.persona?.playstyle === 'early_wall';

  if (me.wallsRemaining > 0 && (isBoxBuildingRival || (isCounterPersona && rivalWallsPlaced >= 1))) {
    const counterWall = findTacticalCounterWall(state, botPlayerId, ctx.persona);
    if (counterWall) {
      const step = accept(counterWall);
      if (step) return step;
    }
  }

  // 5. Native Hybrid AI Engine (AlphaZero Neural Priors + Multi-threaded MCTS + Tactical Minimax Solver)
  // Powered by the calibrated 39-bot personality system with distinct styles and parameters.
  let action: GameAction | null = null;
  let fromNativeEngine = false;
  if (nativeAnalyzer && typeof nativeAnalyzer.getBotActionAsync === 'function' && !ctx.shouldCancel?.()) {
    try {
      const personalityConfig = {
        id: ctx.persona.userId,
        name: ctx.persona.displayName,
        elo: ctx.persona.targetRating,
        temperature: ctx.persona.temperature,
        blunder_rate: ctx.persona.blunderRate,
        blunder_rank_min: 1,
        blunder_rank_max: ctx.persona.targetRating >= 1600 ? 2 : 3,
        wall_prob_bias: ctx.persona.wallProbBias,
        wall_style: ctx.persona.wallStyle,
        opening_style: ctx.persona.openingStyle,
        variety_window: ctx.persona.varietyWindow,
        simulations: ctx.forceMilo ? 8000 : ctx.persona.simulations,
      };

      const engineBotId = ctx.forceMilo ? 'milo' : (ctx.persona.engineBotId || 'achref');
      action = await nativeAnalyzer.getBotActionAsync(
        state,
        engineBotId,
        JSON.stringify(personalityConfig),
        ctx.seed
      );
      if (action) fromNativeEngine = true;
    } catch {
      action = null;
    }
  }

  // 6. Fallback JS MCTS engine when native module is unavailable
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
    // Never accept an action that increases distance when advancing is open,
    // but preserve valid lateral sidesteps (next === current).
    if (next < 0 || (next > current && advancing)) action = advancing;
  } else if (action?.type === 'PLACE_WALL') {
    // If selected by native engine, AlphaZero + MCTS already evaluated deep pathing and long-range setup walls.
    // For fallback non-native engines, verify the wall delays at least one opponent before spending it.
    if (!fromNativeEngine && !wallDelaysRival(state, botPlayerId, {
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

