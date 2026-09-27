import {
  BoardStructure,
  FORK_CAP,
  RouteProfile,
  beginEpoch,
  boardOf,
  packCell,
  packSlot,
  packedSlotsBlockingStep,
  packedSlotsTouchingCell,
  routeOf,
  slotConflicts,
  slotKey,
  unpackSlot,
} from './ai-structure.js';
import { getLegalMoves } from './movement.js';
import { isCenterGoalMode, isGoalCell } from './pathfinding.js';
import { applyAction } from './ruleset.js';
import { CellCoord, GameAction, GameMode, GameState, WallCoord } from './types.js';
import { isLegalWallPlacement } from './walls.js';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIProfile {
  difficulty: AIDifficulty;
  depth: number;
  randomness: number; // 0..1 weight for jitter
  weights: {
    pathDifference: number; // weight for (closestOpponentDistance - ownDistance)
    wallAdvantage: number;  // weight for (ownWalls - opponentWalls)
    mobility: number;       // number of legal moves
    pathways: number;       // log2 of distinct shortest routes (forks are hard to wall)
    /**
     * Corridor width: the narrowest square still ahead, in open edges. This is
     * the pressure term that carries real information — see `tuningFor` for the
     * two measures that turned out NOT to, and why.
     */
    tightness: number;
    /** Placement ranking, multiplayer only. */
    placement: number;
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
      tightness: 0.4,
      placement: 1.0,
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
      tightness: 0.8,
      placement: 1.5,
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
      tightness: 1.2,
      placement: 2.0,
    },
    maxCandidateWalls: 8,
    timeBudgetMs: 120,
  },
};

/** Terminal score. Large enough that no heuristic can outweigh a finished game. */
const WIN_SCORE = 10000;
/** What one place is worth in a finished multiplayer game. */
const PLACEMENT_STEP = 1000;
/** Two scores closer than this are a tie, and ties go to the earlier candidate. */
const TIE_EPSILON = 1e-6;
/** A mover that can reach this will take it and stop looking. */
const MOVER_WIN_BAR = WIN_SCORE - 1;

/**
 * Where the race term stops caring.
 *
 * The outcome of this game saturates: being four steps ahead with walls in hand
 * is a win, and being ten steps ahead is not a *better* win, it is the same win
 * with a bigger number on it. Without this, a linear race term makes the AI
 * prefer a pointless wall that inflates an already-safe margin over simply
 * converting — it would sit and accumulate margin instead of walking home. The
 * softplus-style curve below keeps the gradient steep near zero (one step still
 * means something) and flattens once the result is decided.
 */
const LEAD_SATURATION = 4.5;

/** The race term, saturated so a decided result stops attracting effort. */
function raceTerm(lead: number): number {
  return LEAD_SATURATION * Math.tanh(lead / LEAD_SATURATION);
}

/**
 * Hard depth ceilings.
 *
 * The old numbers (3 for head-to-head, effectively 2 in multiplayer) were chosen
 * when a node was a handful of array lookups. They are now deliberately higher,
 * because node cost came down: the candidate pool is a preallocated open-addressed
 * table instead of a Map, the two slot probes write into scratch instead of
 * returning arrays, inner nodes no longer run the authoritative legality BFS on
 * top of `applyAction`, and mobility is memoised per position. Node cost is what
 * decides whether a ply *completes* inside the budget, so paying for it here buys
 * real plies rather than nominal ones.
 *
 * Multiplayer still starts shallower: Max-n cannot prune at all, so every ply is
 * a full subtree.
 */
const HEAD_TO_HEAD_DEPTH_LIMIT = 6;
const MULTIPLAYER_BASE_DEPTH = 3;
const MULTIPLAYER_DEPTH_LIMIT = 4;

/**
 * Anti-loop penalty, as a tie-breaker.
 *
 * It has to stay under the value of a real step (8-12 points), because when you
 * are genuinely walled in, shuffling IS the correct play. But at a quarter of
 * that it was too weak to order equally-bad options, so a player stuck in a
 * one-wide corridor would happily walk the same three squares round again and
 * again. Half a step is enough to make it prefer the square it visited least
 * recently without ever overruling actual progress.
 */
const REPETITION_SCALE = 0.5;
const ON_PATH_BONUS = 4;
const RACING_BONUS = 3;
/** Share of the structural terms that is added on top of the search value. */
const STRUCTURE_SHARE = 0.5;

/** Candidate-pool bounds. Every list the AI builds is capped: the phone is the target. */
const RAW_SLOT_CAP = 96;
const PROBE_PER_WALL = 6;
const ROUTE_BAND_CELLS = 6;
const APPROACH_CELLS = 3;
const CHAIN_EXTENSION_CELLS = 6;
const CONTEST_DISTANCE = 2;

/**
 * Wall allowance once the search goes deeper than the profile's own depth. The
 * extra ply is *bought* with breadth rather than with time, so a structural
 * position costs roughly what a normal one costs.
 */
const DEEP_WALL_SHARE = 0.6;

/** Transposition table bounds. */
const TT_LIMIT = 20000;

/**
 * Clock sampling interval, in nodes.
 *
 * This used to be 256, back when a node was a handful of array lookups. A node
 * is now a candidate pool plus a legality BFS per wall candidate, so the cheap
 * saving is gone: `Date.now()` costs less than a node does, and checking on
 * every node is what keeps the per-move budget a promise instead of a target.
 */
const CLOCK_SAMPLE = 1;

// ---------------------------------------------------------------------------
// Mode-aware evaluation tuning
// ---------------------------------------------------------------------------

/**
 * How much each structural term counts in a given mode.
 *
 * The rules are shared but the *board* is not, and two of the structural
 * measures this design started with turned out to be structurally constant in
 * this ruleset, so they are not priced at all:
 *
 *   TERRITORY (region size). A legal wall set either leaves the board as one
 *   region or has closed a loop and cut off a sealed pocket: adjacent H slots
 *   overlap and the rules forbid it, so a single lattice row cannot even split
 *   the board. Both players almost always sit in the same 81-cell region.
 *
 *   VIABLE EXITS (count of reachable goal squares). A goal corner is entered
 *   from one horizontal and one vertical neighbour, and the two wall slots that
 *   close those edges cross each other, so no goal square can be sealed off: the
 *   goal edge is always connected and always reachable. The count is 9 on every
 *   edge-goal board and 1 in Center Rush, forever.
 *
 * What does vary, and is priced, is corridor width (`tightest`) and route
 * diversity (`pathways`) — plus placement in multiplayer. And the *behaviour*
 * the exit count was standing in for is implemented where it can actually work:
 * the candidate pool aims at a rival's goal approaches, and the structural terms
 * credit narrowing the way in rather than removing a square that cannot be
 * removed.
 */
interface EvalTuning {
  tightness: number;
  placement: number;
}

function tuningFor(
  mode: GameMode,
  playerCount: number,
  weights: AIProfile['weights']
): EvalTuning {
  const multi = playerCount >= 3;
  const placement = multi ? weights.placement : 0;

  // Center Rush: one winning square means route diversity is the only way to be
  // hard to shut out, and being funnelled is the only way to lose — so both
  // structural terms count for more than they do in a classic duel.
  if (isCenterGoalMode(mode)) {
    return { tightness: weights.tightness * 1.5, placement };
  }
  // Race: everybody shares one goal edge, so being squeezed is a lost race and
  // having options is worth more. Corridor width matters less, because the
  // spread-out field self-corrects.
  if (mode === 'race2' || mode === 'race3' || mode === 'race4') {
    return { tightness: weights.tightness * 0.6, placement };
  }
  // Classic duel: the board decides it, so the two structural terms carry their
  // plain weight.
  return { tightness: weights.tightness, placement };
}

function logCount(value: number): number {
  return Math.log2(1 + Math.min(value, FORK_CAP));
}

/**
 * Legal-move count per seat, memoised over the last two positions.
 *
 * `evaluateState` is the leaf of the whole engine and asks every seat how many
 * moves it has, and each `getLegalMoves` call builds a wall index from scratch.
 * In a Max-n node the same position is then evaluated twice — once for the
 * mover's own choice, once as the root's leaf — and in a 4-player leaf four
 * times over. Two slots of memo is enough to remove all of it without holding
 * positions alive.
 */
const MOBILITY_MEMO = 2;
const mobilityMemoState: GameState[] = [null as unknown as GameState, null as unknown as GameState];
const mobilityMemoCounts: number[][] = [[], []];

function mobilityOf(state: GameState, playerIndex: number): number {
  for (let slot = 0; slot < MOBILITY_MEMO; slot++) {
    if (mobilityMemoState[slot] === state) {
      const cached = mobilityMemoCounts[slot][playerIndex];
      if (cached !== undefined) return cached;
    }
  }
  const player = state.players[playerIndex];
  if (!player) return 0;
  const count = getLegalMoves(state, player.id).length;
  // Newest first, so a leaf evaluated four times in a row hits on every call.
  mobilityMemoState[1] = mobilityMemoState[0];
  mobilityMemoCounts[1] = mobilityMemoCounts[0];
  mobilityMemoState[0] = state;
  mobilityMemoCounts[0] = [count];
  return count;
}

/** Drops the memo, so a new search never answers from a previous position. */
function resetMobilityMemo(): void {
  mobilityMemoState[0] = null as unknown as GameState;
  mobilityMemoState[1] = null as unknown as GameState;
  mobilityMemoCounts[0] = [];
  mobilityMemoCounts[1] = [];
}

/** Stand-in for a rival with no reachable goal, which the rules forbid. */
const NEUTRAL_ROUTE: RouteProfile = {
  playerId: '',
  distance: 0,
  pathCount: 0,
  firstSteps: [],
  goalCells: 1,
  nearestGoals: 1,
  goalCellsNear: [],
  nearCells: [],
  region: 0,
  regionSize: 1,
  exitEdges: 0,
  openings: 4,
  tightest: 4,
  reach: 1,
  hasGoalAccess: false,
};

function placementOf(state: GameState, playerId: string): number | null {
  const recorded = state.placements.find((p) => p.playerId === playerId);
  if (recorded) return recorded.place;
  const seat = state.players.find((p) => p.id === playerId);
  return seat && seat.place !== null ? seat.place : null;
}

/**
 * Score of a finished game from one seat's point of view.
 *
 * 1v1 keeps the simple winner-id reading: the match ends on the decisive action
 * and no placements are recorded. Multiplayer ranks properly, because in 3P/4P
 * reaching your edge only buys a *place* — reading second place as a win would
 * make the search play for the wrong thing exactly when it matters most.
 */
function terminalScore(state: GameState, playerId: string): number {
  const place = placementOf(state, playerId);
  if (place === null) {
    return state.winnerId === playerId ? WIN_SCORE : -WIN_SCORE;
  }
  if (place <= 1) return WIN_SCORE;
  return -WIN_SCORE + place * Math.floor(WIN_SCORE / (state.players.length + 1));
}

/**
 * Static evaluation of a game state from the perspective of `activePlayerId`.
 * Higher score is better for `activePlayerId`.
 *
 * The dominant term is still the race — `pathAdvantage * pathDifference`, one
 * step of progress. Everything else is a refinement the race cannot express:
 * how many distinct routes exist, how many winning squares are still viable,
 * how much room is left, whether this side is one wall from being shut in, and
 * with three or four players how many rivals are already ahead of it.
 *
 * Every term is a function of distances, counts and region sizes only, never of
 * absolute coordinates, so mirror-image positions always score identically.
 */
export function evaluateState(state: GameState, activePlayerId: string, profile: AIProfile): number {
  if (state.status === 'COMPLETED') return terminalScore(state, activePlayerId);

  const me = state.players.find((p) => p.id === activePlayerId);
  if (!me) return 0;

  const board = boardOf(state);
  const own = routeOf(state, board, me);

  if (me.status === 'FINISHED') {
    const place = me.place ?? placementOf(state, activePlayerId) ?? 1;
    return WIN_SCORE - (place - 1) * PLACEMENT_STEP;
  }
  if (!own.hasGoalAccess) return -WIN_SCORE;
  if (own.distance === 0) return WIN_SCORE;

  const opponents = state.players.filter((p) => p.id !== activePlayerId);
  if (opponents.length === 0) return 0;
  const tuning = tuningFor(state.mode, state.players.length, profile.weights);

  let minOpponentDist = Infinity;
  let threat: RouteProfile | null = null;
  let totalOpponentWalls = 0;
  let totalOpponentMobility = 0;
  let ahead = 0;
  let behind = 0;

  for (const opp of opponents) {
    const route = routeOf(state, board, opp);
    if (route.hasGoalAccess) {
      if (route.distance < minOpponentDist) {
        minOpponentDist = route.distance;
        // Forks and exits are read off the closest threat, matching the race term.
        threat = route;
      }
      if (route.distance < own.distance) ahead++;
      else if (route.distance > own.distance) behind++;
    }
    totalOpponentWalls += opp.wallsRemaining;
    totalOpponentMobility += mobilityOf(state, opp.index);
  }

  const rival = threat ?? { ...NEUTRAL_ROUTE, distance: own.distance };
  const ownMobility = mobilityOf(state, me.index);

  const pathAdvantage = raceTerm(minOpponentDist - own.distance);
  const wallAdvantage = me.wallsRemaining - totalOpponentWalls / opponents.length;
  const mobilityAdvantage = ownMobility - totalOpponentMobility / opponents.length;
  // Route diversity: how many equally short ways there are to the line. A player
  // with five of them is very hard to wall down; one on a single corridor is
  // trivially blocked, and plain distance cannot tell those apart.
  const forkAdvantage = logCount(own.pathCount) - logCount(rival.pathCount);
  // Corridor width: the narrowest square still ahead. A player walking a
  // one-wide corridor has no choices left, whatever the total cell count says.
  const tightnessAdvantage = own.tightest - rival.tightest;
  // Distinct optimal first steps: is the next move a decision or a formality?
  const detourAdvantage =
    Math.log2(1 + own.firstSteps.length) - Math.log2(1 + rival.firstSteps.length);
  const placementAdvantage = tuning.placement > 0 ? (ahead - behind) * tuning.placement : 0;

  return (
    pathAdvantage * profile.weights.pathDifference +
    wallAdvantage * profile.weights.wallAdvantage +
    mobilityAdvantage * profile.weights.mobility +
    forkAdvantage * profile.weights.pathways +
    tightnessAdvantage * tuning.tightness +
    detourAdvantage * profile.weights.pathways * 0.5 +
    placementAdvantage
  );
}

// ---------------------------------------------------------------------------
// Anti-loop and path helpers
// ---------------------------------------------------------------------------

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
 * First step of the player's optimal (BFS shortest) route to goal, or null when
 * no route exists. BFS on an unweighted grid is optimal, so this is the "best
 * algorithm" answer for reaching the target.
 */
export function shortestPathStep(state: GameState, playerId: string): CellCoord | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const board = boardOf(state);
  const route = routeOf(state, board, player);
  if (!route.hasGoalAccess) return null;
  return route.firstSteps[0] ?? null;
}

// ---------------------------------------------------------------------------
// Tactical / structural read
// ---------------------------------------------------------------------------

export type AiPressure = 'NORMAL' | 'STRUCTURAL' | 'TACTICAL';
export type AiIntent = 'NONE' | 'WIN' | 'BLOCK' | 'ESCAPE' | 'SHAPE';

export interface AiTactical {
  pressure: AiPressure;
  intent: AiIntent;
  /** Extra plies this position is allowed to spend. Zero on a normal board. */
  extraDepth: number;
  /** Search only the candidates that address the threat. */
  restrict: boolean;
  /** Packed cells that win immediately. */
  winningCells: Set<number>;
  /** Packed wall slots that close a rival's way onto a viable goal square. */
  blockingSlots: Set<number>;
  /** Packed optimal first steps: the escape set when this side is closing in. */
  escapeCells: Set<number>;
  /** Why the position was classified this way. Surfaced in tests and debugging. */
  reason: string;
}

const NEUTRAL_TACTICAL: AiTactical = {
  pressure: 'NORMAL',
  intent: 'NONE',
  extraDepth: 0,
  restrict: false,
  winningCells: new Set(),
  blockingSlots: new Set(),
  escapeCells: new Set(),
  reason: 'nothing special',
};

/**
 * Reads the board once per turn and decides how much calculation this position
 * deserves, before any search happens.
 *
 * This is deliberately NOT "search deeper everywhere". Depth is the expensive
 * thing on a phone, so it is spent only where the answer is not obvious:
 *
 *   TACTICAL   an immediate win, a rival one step from their line, or this side
 *              about to be shut in. Only the address candidates are searched,
 *              and the extra plies are spent on those few.
 *   STRUCTURAL a single-file route beside real wall structure, or a narrow
 *              region with chains on the board. One extra ply, paid for with a
 *              smaller wall allowance rather than with more time.
 *   NORMAL     the profile's own depth, unchanged.
 */
export function readTacticalState(state: GameState, playerId: string): AiTactical {
  if (state.status !== 'IN_PROGRESS') return NEUTRAL_TACTICAL;
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return NEUTRAL_TACTICAL;

  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const escapeCells = new Set(own.firstSteps.map(packCell));

  // 1. Immediate win: take it, do not think about anything else.
  const winningCells = new Set<number>();
  for (const to of getLegalMoves(state, playerId)) {
    if (isGoalCell(to, me.goalDirection, state.mode)) winningCells.add(packCell(to));
  }
  if (winningCells.size > 0) {
    return {
      pressure: 'TACTICAL',
      intent: 'WIN',
      extraDepth: 2,
      restrict: true,
      winningCells,
      blockingSlots: new Set(),
      escapeCells,
      reason: 'immediate win available',
    };
  }

  // 2. A rival standing one step from their own line, or from any of the goal
  //    squares that are still viable. Every slot that could close one of their
  //    ways out is a candidate; scoring decides which one actually works.
  const blockingSlots = new Set<number>();
  let nearestName = '';
  let nearestDistance = Infinity;
  for (const opp of state.players) {
    if (opp.id === playerId || opp.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, opp);
    if (!route.hasGoalAccess || route.distance > 1) continue;
    if (route.distance < nearestDistance) {
      nearestDistance = route.distance;
      nearestName = opp.displayName;
    }
    const n = packedSlotsBlockingStep(opp.position.row, opp.position.col, packedScratch);
    for (let i = 0; i < n; i++) blockingSlots.add(packedScratch[i]);
  }
  if (blockingSlots.size > 0) {
    return {
      pressure: 'TACTICAL',
      intent: 'BLOCK',
      extraDepth: 2,
      restrict: true,
      winningCells,
      blockingSlots,
      escapeCells,
      reason: `${nearestName} is one step from the line`,
    };
  }

  // 3. Corridor pressure: the tightest square still ahead is a dead end, and
  //    somebody with walls left can keep it that way. Escape set is the optimal
  //    route, because in a dead end the only way out is forward.
  if (own.hasGoalAccess && own.tightest <= 1 && own.distance > 1) {
    const sealer = state.players.find(
      (p) => p.id !== playerId && p.status === 'ACTIVE' && p.wallsRemaining > 0
    );
    if (sealer) {
      return {
        pressure: 'TACTICAL',
        intent: 'ESCAPE',
        extraDepth: 1,
        restrict: true,
        winningCells,
        blockingSlots,
        escapeCells,
        reason: `route narrows to ${own.tightest} opening with ${sealer.displayName} still holding walls`,
      };
    }
  }

  // 4. Structural pressure. A route with a single optimal first step is a
  //    corridor, and a corridor next to walls is a decision rather than a
  //    formality. Forced jumps count too: if every way forward is a jump, the
  //    route is as fragile as a corridor.
  const chains = board.field.chains;
  const longestChain = chains.reduce((max, c) => Math.max(max, c.slots.length), 0);
  const forcedJump =
    own.firstSteps.length > 0 &&
    own.firstSteps.every(
      (s) => Math.abs(s.row - me.position.row) + Math.abs(s.col - me.position.col) > 1
    );
  const corridor =
    own.firstSteps.length <= 1 && (forcedJump || longestChain >= 2 || chains.length >= 2);
  const narrow = own.hasGoalAccess && own.tightest <= 2 && chains.length >= 1;
  const rivalCorridor =
    me.wallsRemaining > 0 &&
    state.players.some((p) => p.id !== playerId && routeOf(state, board, p).firstSteps.length <= 1);
  if (corridor || narrow || rivalCorridor) {
    const reason = corridor
      ? 'single-file route beside wall structure'
      : narrow
      ? `route narrows to ${own.tightest} opening`
      : 'a rival is running a single-file route';
    return {
      pressure: 'STRUCTURAL',
      intent: 'SHAPE',
      extraDepth: 1,
      restrict: false,
      winningCells,
      blockingSlots,
      escapeCells,
      reason,
    };
  }

  return { ...NEUTRAL_TACTICAL, escapeCells };
}

// ---------------------------------------------------------------------------
// Candidate actions
// ---------------------------------------------------------------------------

/** Why a wall slot is worth probing. Combined as bit flags, summed for priority. */
const SLOT_THREAT = 1;
const SLOT_ROUTE = 2;
const SLOT_APPROACH = 8;
const SLOT_CHAIN = 16;
const SLOT_SELF_ROUTE = 32;
const SLOT_CONTESTED = 64;

function slotPriority(reason: number): number {
  let score = 0;
  if (reason & SLOT_THREAT) score += 6;
  if (reason & SLOT_APPROACH) score += 3;
  if (reason & SLOT_ROUTE) score += 2;
  if (reason & SLOT_CHAIN) score += 2;
  if (reason & SLOT_CONTESTED) score += 1;
  if (reason & SLOT_SELF_ROUTE) score += 1;
  return score;
}

/**
 * What one wall candidate actually does to the shape of the board, measured once
 * during generation so neither the search nor the root scoring has to rediscover
 * it.
 */
export interface WallInsight {
  slot: WallCoord;
  /** Steps this wall adds to the closest rival's route. */
  delay: number;
  /** Steps this wall costs this player's own route. */
  selfCost: number;
  /** How much narrower this wall makes the closest rival's route ahead. */
  narrowAdv: number;
  /**
   * How much of the rival's route diversity this wall removes, even at no
   * distance cost. This is what lets the AI build a funnel BEFORE the opponent
   * is walking into it: a wall that costs nothing today and leaves them one way
   * in instead of four is worth something, and waiting until they are inside is
   * how a centre approach gets lost.
   */
  forkDeny: number;
  /** Extends an existing wall chain. */
  extendsChain: boolean;
  /** Turns an existing chain instead of continuing it. */
  turnsChain: boolean;
  /** Merges two different chains. */
  bridgesChains: boolean;
  /** Sits on this player's own route, so it shapes their own corridor. */
  shapesSelf: boolean;
  /** Touches a square both this player and a rival must cross. */
  contested: boolean;
  /** Structural value in the same units as the search score, delay excluded. */
  structure: number;
}

export interface ScoredCandidate {
  action: GameAction;
  /** The move starts an equally short route. */
  onPath: boolean;
  /** Wall analysis, or null for a move. */
  wall: WallInsight | null;
  /** Pre-search rank: what the search should look at first. */
  rank: number;
  /** Deterministic total-order key: moves 0..80, then wall slots from 128. */
  order: number;
}

function moveOrder(to: CellCoord): number {
  return packCell(to);
}

function wallOrder(slot: WallCoord): number {
  return 128 + packSlot(slot);
}

/**
 * On-path first, then best pre-search rank, then a deterministic total order.
 * On-path moves go first because that is the cheapest large alpha-beta speedup
 * available, and the route profile has already paid for the BFS that finds them.
 */
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.onPath !== b.onPath) return a.onPath ? -1 : 1;
  if (a.rank !== b.rank) return b.rank - a.rank;
  return a.order - b.order;
}

interface WallSlotIdea {
  /** Packed slot: no string allocation in the hot path. */
  packed: number;
  reason: number;
  priority: number;
}

const packedScratch = new Int32Array(8);

/** Packed slot id -> "row,col,orientation", for the few string-keyed maps. */
function packedName(packed: number): string {
  const row = Math.floor(packed / 16);
  const col = Math.floor(packed / 2) % 8;
  return `${row},${col},${packed % 2 === 1 ? 'V' : 'H'}`;
}

/** O(1) conflict test on a packed slot id, against a prebuilt wall index. */
function slotConflictsPacked(index: Uint8Array, packed: number): boolean {
  return slotConflicts(index, unpackSlot(packed));
}

/**
 * Fixed-capacity slot pool.
 *
 * The candidate pool is rebuilt at every node of every search, so it is a plain
 * open-addressed table over a preallocated array rather than a Map: no
 * allocation, no hashing, and a hard cap that costs nothing to enforce. Capacity
 * is twice the pool limit, so linear probing never degrades in practice.
 */
class SlotPool {
  private readonly keys = new Int32Array(RAW_SLOT_CAP * 2).fill(-1);
  private readonly reasons = new Int32Array(RAW_SLOT_CAP * 2);
  private readonly priorities = new Int32Array(RAW_SLOT_CAP * 2);
  private count = 0;

  clear(): void {
    this.keys.fill(-1);
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  full(): boolean {
    return this.count >= RAW_SLOT_CAP;
  }

  reasonAt(packed: number): number {
    const slot = this.find(packed);
    return slot < 0 ? 0 : this.reasons[slot];
  }

  add(packed: number, reason: number): void {
    const existing = this.find(packed);
    if (existing >= 0) {
      this.reasons[existing] |= reason;
      this.priorities[existing] = slotPriority(this.reasons[existing]);
      return;
    }
    if (this.count >= RAW_SLOT_CAP) return;
    const slot = this.count * 2;
    this.keys[slot] = packed;
    this.reasons[slot] = reason;
    this.priorities[slot] = slotPriority(reason);
    this.count++;
  }

  /** Best-first, then packed-slot order: a total, deterministic order. */
  drain(out: WallSlotIdea[]): WallSlotIdea[] {
    for (let i = 0; i < this.count; i++) {
      out.push({ packed: this.keys[i * 2], reason: this.reasons[i * 2], priority: this.priorities[i * 2] });
    }
    out.sort((a, b) => (a.priority !== b.priority ? b.priority - a.priority : a.packed - b.packed));
    return out;
  }

  private find(packed: number): number {
    const mask = this.keys.length - 1;
    let slot = packed & mask;
    for (let probe = 0; probe < this.keys.length; probe++) {
      const key = this.keys[slot];
      if (key === packed) return slot >> 1;
      if (key === -1) return -1;
      slot = (slot + 1) & mask;
    }
    return -1;
  }
}

const poolScratch = new SlotPool();

/** Counts of route cells, so contested squares can be found without a Map. */
class CellTally {
  private readonly keys = new Int32Array(256).fill(-1);
  private readonly counts = new Int32Array(256);
  private count = 0;

  clear(): void {
    this.keys.fill(-1);
    this.count = 0;
  }

  bump(packed: number): void {
    const mask = this.keys.length - 1;
    let slot = packed & mask;
    for (let probe = 0; probe < this.keys.length; probe++) {
      const key = this.keys[slot];
      if (key === packed) {
        this.counts[slot]++;
        return;
      }
      if (key === -1) {
        this.keys[slot] = packed;
        this.counts[slot] = 1;
        this.count++;
        return;
      }
      slot = (slot + 1) & mask;
    }
  }

  atLeast(packed: number, needed: number): boolean {
    const mask = this.keys.length - 1;
    let slot = packed & mask;
    for (let probe = 0; probe < this.keys.length; probe++) {
      const key = this.keys[slot];
      if (key === packed) return this.counts[slot] >= needed;
      if (key === -1) return false;
      slot = (slot + 1) & mask;
    }
    return false;
  }
}

const contestedScratch = new CellTally();

/** The rival route cells a chain extension has to reach to be worth playing. */
class RouteCellSet {
  private readonly cells = new Int32Array(128);
  private count = 0;

  clear(): void {
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  add(nearCells: CellCoord[]): void {
    for (const cell of nearCells) {
      if (this.count >= this.cells.length) return;
      this.cells[this.count++] = packCell(cell);
    }
  }

  /** Chebyshev proximity from a packed wall slot to any recorded cell. */
  nearPacked(slot: number, radius: number): boolean {
    const row = Math.floor(slot / 16);
    const col = Math.floor(slot / 2) % 8;
    for (let i = 0; i < this.count; i++) {
      const cell = this.cells[i];
      if (Math.abs(Math.floor(cell / 9) - row) <= radius && Math.abs((cell % 9) - col) <= radius) {
        return true;
      }
    }
    return false;
  }
}

const rivalScratch = new RouteCellSet();

/**
 * Builds the prioritised wall-slot pool for a turn.
 *
 * The old engine sampled walls reactively: the slots beside the first few
 * squares of a rival's current shortest path, in a fixed scan order, first N
 * legal wins. That is why it could only ever react, and why it systematically
 * favoured one row and one orientation. This pool asks the structural question
 * instead — *where would this board's shape actually change* — and takes
 * contributions from six sources:
 *
 *   1. slots that close a rival's way onto a viable goal square,
 *   2. slots around those viable goal squares (exit denial),
 *   3. slots on a rival's region boundary (closing exits),
 *   4. slots along a rival's optimal route (corridor control),
 *   5. slots that extend, turn or bridge this player's own wall chains,
 *   6. slots on this player's own boundary, where a seal against them would go,
 *
 * plus a bonus for contested squares that both sides must cross.
 *
 * Pure arithmetic and array work — no BFS runs here — so it is cheap enough to
 * also run at every inner search node.
 */
function collectWallSlotIdeas(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string
): WallSlotIdea[] {
  const index = board.field.index;
  const pool = poolScratch;
  pool.clear();
  const scratch = packedScratch;
  // O(1) conflict test on add: same slot, a cross, or a one-cell overlap.
  const addPacked = (packed: number, reason: number) => {
    if (pool.full()) return;
    if (pool.reasonAt(packed) === 0 && slotConflictsPacked(index, packed)) return;
    pool.add(packed, reason);
  };

  // Squares that appear on more than one player's optimal route: the places
  // where a wall is contested, and the only places a wall can be structural.
  const contestedCells = contestedScratch;
  contestedCells.clear();
  for (const player of state.players) {
    for (const cell of routeOf(state, board, player).nearCells) {
      contestedCells.bump(packCell(cell));
    }
  }

  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, rival);
    if (!route.hasGoalAccess) continue;

    // 1. Immediate threat: a rival one step out closes with one wall.
    if (route.distance <= 1) {
      const n = packedSlotsBlockingStep(rival.position.row, rival.position.col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_THREAT);
    }

    // 2. Viable goal approaches: the squares this rival can still finish on. In
    //    a race the whole goal edge is shared, so denying these *is* exit
    //    denial — there is no other door.
    const goals = route.goalCellsNear;
    for (let g = 0; g < goals.length && g < APPROACH_CELLS; g++) {
      const n = packedSlotsTouchingCell(goals[g].row, goals[g].col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_APPROACH);
    }

    // 3. The route itself, and the contested squares along it.
    const cells = route.nearCells;
    for (let c = 0; c < cells.length && c < ROUTE_BAND_CELLS; c++) {
      const reason =
        contestedCells.atLeast(packCell(cells[c]), 2)
          ? SLOT_ROUTE | SLOT_CONTESTED
          : SLOT_ROUTE;
      const n = packedSlotsTouchingCell(cells[c].row, cells[c].col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], reason);
    }
  }

  // 4. Build on this player's own structure, but only where it already reaches
  //    a rival: a chain extended into open space is just a tempo cost.
  const rivals = rivalScratch;
  rivals.clear();
  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess) rivals.add(route.nearCells);
  }
  if (rivals.size > 0 && own.hasGoalAccess) {
    let extensions = 0;
    for (const chain of board.field.chains) {
      if (chain.slots.length === 0 || extensions >= CHAIN_EXTENSION_CELLS) continue;
      const anchor = chain.slots[0];
      const n = packedSlotsTouchingCell(anchor.row, anchor.col, scratch);
      for (let i = 0; i < n && extensions < CHAIN_EXTENSION_CELLS; i++) {
        if (!board.field.chainTouch.has(packedName(scratch[i]))) continue;
        if (!rivals.nearPacked(scratch[i], CONTEST_DISTANCE)) continue;
        addPacked(scratch[i], SLOT_CHAIN);
        extensions++;
      }
    }
  }

  // 5. This player's own route. Slots beside your own line are the only way to
  //    build a protected corridor for yourself, which purely reactive play can
  //    never do — and `selfCost` prices the ones that get in the way.
  const ownCells = own.nearCells;
  for (let c = 0; c < ownCells.length && c < APPROACH_CELLS + 1; c++) {
    const n = packedSlotsTouchingCell(ownCells[c].row, ownCells[c].col, scratch);
    for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_SELF_ROUTE);
  }

  const ideas: WallSlotIdea[] = [];
  return pool.drain(ideas);
}

function packedKey(slot: WallCoord): string {
  return slotKey(slot);
}

function moveCandidates(state: GameState, playerId: string, own: RouteProfile): ScoredCandidate[] {
  const onPath = new Set(own.firstSteps.map(packCell));
  const out: ScoredCandidate[] = [];
  for (const to of getLegalMoves(state, playerId)) {
    out.push({
      action: { type: 'MOVE', to },
      onPath: onPath.has(packCell(to)),
      wall: null,
      rank: 0,
      order: moveOrder(to),
    });
  }
  return out;
}

/**
 * Wall candidates for the ROOT of a search, ranked by immediate delay AND by the
 * structure they enable or prevent.
 *
 * This is the expensive builder, and it runs once per turn. It pays for a
 * distance measurement per probed slot, so the slots handed to the search are
 * the ones that actually do something, and the ones it drops are dropped for a
 * recorded reason. `maxWalls` is honoured after ranking, not during scanning.
 */
function buildRootCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile,
  tactical: AiTactical,
  deadline: number
): ScoredCandidate[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.wallsRemaining <= 0 || profile.maxCandidateWalls <= 0) {
    return moveCandidates(state, playerId, own);
  }

  const rivals = state.players.filter(
    (p) => p.id !== playerId && p.status === 'ACTIVE' && routeOf(state, board, p).hasGoalAccess
  );
  if (rivals.length === 0) return moveCandidates(state, playerId, own);

  const ideas = collectWallSlotIdeas(state, board, own, playerId);
  const probeCap = Math.min(ideas.length, profile.maxCandidateWalls * PROBE_PER_WALL);
  const perStep = profile.weights.pathDifference;
  const focus = 1 - profile.randomness;
  const walls: ScoredCandidate[] = [];

  for (let i = 0; i < probeCap; i++) {
    // Probing costs a legality BFS per active player plus one distance BFS per
    // rival, so it is budget-checked too. Legal moves are already in hand, so
    // stopping here still returns a legal action.
    if (pastDeadline(deadline, i)) break;
    const slot = unpackSlot(ideas[i].packed);
    // Authoritative legality, every time: the rules own this decision.
    if (!isLegalWallPlacement(state, playerId, slot)) continue;
    const applied = applyAction(state, { type: 'PLACE_WALL', wall: slot });
    if (!applied.success) continue;
    const next = applied.state;
    const nextBoard = boardOf(next);

    let before = Infinity;
    let after = Infinity;
    let rivalBefore: RouteProfile | null = null;
    let rivalAfter: RouteProfile | null = null;
    for (const rival of rivals) {
      const b = routeOf(state, board, rival);
      const a = routeOf(next, nextBoard, rival);
      if (b.distance < before) {
        before = b.distance;
        rivalBefore = b;
      }
      if (a.distance < after) {
        after = a.distance;
        rivalAfter = a;
      }
    }

    const delay = before === Infinity ? 0 : Math.max(0, after - before);
    const ownAfter = routeOf(next, nextBoard, me);
    const selfCost =
      own.hasGoalAccess && ownAfter.hasGoalAccess
        ? Math.max(0, ownAfter.distance - own.distance)
        : 0;
    // Funnelling: not "fewer winning squares" — the goal edge is always
    // connected, so that count never moves — but "a narrower way in", which does.
    const narrowAdv =
      rivalBefore && rivalAfter ? Math.max(0, rivalBefore.tightest - rivalAfter.tightest) : 0;
    // Route diversity lost at no distance cost. This is the term that lets the AI
    // build a funnel BEFORE the opponent is walking into it, instead of waiting
    // until they are on top of it: a wall that costs nothing today and leaves
    // them one way in instead of four is already worth something.
    const forkDeny =
      rivalBefore && rivalAfter
        ? Math.max(0, logCount(rivalBefore.pathCount) - logCount(rivalAfter.pathCount))
        : 0;

    const key = packedKey(slot);
    const touches = board.field.chainTouch.get(key) ?? 0;
    const extendsChain = touches > 0;
    const bridgesChains = touches >= 2;
    const turnsChain = board.field.turnExtensions.has(key);
    const shapesSelf = (ideas[i].reason & SLOT_SELF_ROUTE) !== 0;
    const contested = (ideas[i].reason & SLOT_CONTESTED) !== 0;

    // Structural value, in the same "step" units as the search score. Delay is
    // deliberately excluded: it is credited separately as a horizon correction,
    // and counting it twice would make walling look twice as good as it is.
    const structure =
      (narrowAdv * perStep * 0.5 +
        forkDeny * perStep * 0.4 +
        (extendsChain ? perStep * 0.4 : 0) +
        (turnsChain ? perStep * 0.3 : 0) +
        (bridgesChains ? perStep * 0.5 : 0) +
        (shapesSelf ? perStep * 0.3 : 0) +
        (contested ? perStep * 0.25 : 0)) *
      focus;

    walls.push({
      action: { type: 'PLACE_WALL', wall: slot },
      onPath: false,
      wall: {
        slot,
        delay,
        selfCost,
        narrowAdv,
        forkDeny,
        extendsChain,
        turnsChain,
        bridgesChains,
        shapesSelf,
        contested,
        structure,
      },
      // Selection rank: what the search is most likely to want, delay included.
      rank: delay * perStep + structure - selfCost * perStep,
      order: wallOrder(slot),
    });
  }

  walls.sort(compareCandidates);
  const kept = walls.slice(0, profile.maxCandidateWalls);

  const moves = moveCandidates(state, playerId, own);
  let all = moves.concat(kept);
  all.sort(compareCandidates);

  // Tactical narrowing, applied AFTER scoring so it is never applied blind: a
  // block that delays nobody is not a block, and a square that is not reachable
  // is not an escape.
  if (tactical.restrict) {
    let filtered: ScoredCandidate[] = [];
    if (tactical.intent === 'WIN') {
      filtered = all.filter(
        (c) => c.action.type === 'MOVE' && tactical.winningCells.has(packCell(c.action.to))
      );
    } else if (tactical.intent === 'BLOCK') {
      filtered = all.filter(
        (c) =>
          c.action.type === 'PLACE_WALL' &&
          c.wall !== null &&
          tactical.blockingSlots.has(packSlot(c.action.wall)) &&
          c.wall.delay > 0
      );
      // Nothing legal actually stops the win. Throwing a wall that does not
      // block is how a player loses a game they were already losing slowly
      // instead of racing for it: the turn is spent either way, so spend it
      // moving. Moves only, no walls at all.
      if (filtered.length === 0) {
        return moveCandidates(state, playerId, own).sort(compareCandidates);
      }
    } else if (tactical.intent === 'ESCAPE') {
      filtered = all.filter(
        (c) => c.action.type === 'MOVE' && tactical.escapeCells.has(packCell(c.action.to))
      );
    }
    if (filtered.length > 0) {
      all = filtered;
      // A critical position is where extra calculation pays, so the wall
      // allowance the narrowing freed is spent on shaping — but ONLY while
      // escaping. When a win is on the board, or when a rival is one step from
      // their line, the restriction is absolute: nothing that is not the win, or
      // not the block, may be considered at all.
      if (tactical.intent === 'ESCAPE' && walls.length > profile.maxCandidateWalls) {
        const keptOrders = new Set(filtered.map((c) => c.order));
        const extra = walls
          .slice(profile.maxCandidateWalls, profile.maxCandidateWalls * 2)
          .filter((w) => !keptOrders.has(w.order));
        if (extra.length > 0) all = all.concat(extra).sort(compareCandidates);
      }
    }
  }

  return all;
}

/**
 * Cheap candidate list for inner search nodes.
 *
 * Inner nodes need breadth, not precision: alpha-beta prunes far better when
 * the best-looking move is visited first, and measuring delay here would cost a
 * BFS per candidate per node. The root already measured and ordered the tree, so
 * inner nodes take the highest-priority slots and let the search judge them on
 * the evaluation.
 *
 * Note what is NOT here: a legality check. The pool has already rejected every
 * occupied, crossed and overlapping slot in O(1), and the only remaining way to be
 * illegal is to seal somebody in — rare, and `applyAction` at the node rejects it
 * for free. Running the authoritative BFS-based check here as well doubled the
 * cost of every node for nothing, and node cost is exactly what decides whether
 * a ply finishes inside the budget.
 */
function buildSearchCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile
): ScoredCandidate[] {
  const me = state.players[state.currentPlayerIndex];
  const moves = moveCandidates(state, playerId, own);
  const wallBudget =
    me && me.id === playerId ? profile.maxCandidateWalls : 0;
  if (!me || me.wallsRemaining <= 0 || wallBudget <= 0) {
    moves.sort(compareCandidates);
    return moves;
  }

  const ideas = collectWallSlotIdeas(state, board, own, playerId);
  const walls: ScoredCandidate[] = [];
  for (const idea of ideas) {
    if (walls.length >= wallBudget) break;
    const slot = unpackSlot(idea.packed);
    walls.push({
      action: { type: 'PLACE_WALL', wall: slot },
      onPath: false,
      wall: null,
      rank: idea.priority,
      order: wallOrder(slot),
    });
  }

  const all = moves.concat(walls);
  all.sort(compareCandidates);
  return all;
}

/**
 * Selects candidate actions for the AI, for callers that only need the list.
 * `maxWalls` caps how many wall candidates are kept.
 */
export function getCandidateActions(
  state: GameState,
  playerId: string,
  maxWalls: number
): GameAction[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  beginEpoch();
  const board = boardOf(state);
  const own = routeOf(state, board, player);
  const profile: AIProfile = { ...AI_PROFILES.normal, maxCandidateWalls: Math.max(0, maxWalls) };
  return buildRootCandidates(
    state,
    board,
    own,
    playerId,
    profile,
    NEUTRAL_TACTICAL,
    Number.POSITIVE_INFINITY
  ).map((c) => c.action);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Transposition entry: EXACT, LOWER bound (fail-high) or UPPER bound (fail-low). */
interface TtEntry {
  depth: number;
  value: number;
  bound: 0 | 1 | 2;
}

/**
 * Search bookkeeping shared by every node of one root search.
 *
 * `deadline` is a wall-clock budget in ms. The search checks it on entry to each
 * node and unwinds via `aborted` rather than running to completion, which is
 * what keeps a slow device from freezing the UI: the caller falls back to the
 * best action from the last depth that finished.
 */
interface SearchContext {
  profile: AIProfile;
  rootId: string;
  deadline: number;
  aborted: boolean;
  nodes: number;
  tt: Map<string, TtEntry>;
  /** Multiplayer uses Max-n and cannot prune, so it is searched shallower. */
  multiplayer: boolean;
}

function newSearchContext(
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
    tt: new Map<string, TtEntry>(),
    multiplayer: state.players.length > 2,
  };
}

function outOfTime(ctx: SearchContext): boolean {
  if (ctx.aborted) return true;
  if (ctx.deadline === Number.POSITIVE_INFINITY) return false;
  if (ctx.nodes % CLOCK_SAMPLE === 0 && Date.now() > ctx.deadline) {
    ctx.aborted = true;
    return true;
  }
  return false;
}

/** Same sampling discipline, for the one-off work a root turn does. */
function pastDeadline(deadline: number, tick: number): boolean {
  if (deadline === Number.POSITIVE_INFINITY) return false;
  return tick % 4 === 0 && Date.now() > deadline;
}

/**
 * Transposition key: board, turn, and every piece of state the evaluation and
 * the Max-n node choice can see. Wall positions arrive pre-hashed in
 * `board.key`, so this is one join per node rather than a wall sort.
 */
function transpositionKey(state: GameState, board: BoardStructure): string {
  const parts: string[] = [board.key, String(state.currentPlayerIndex), state.status];
  if (state.winnerId) parts.push(state.winnerId);
  for (const p of state.players) {
    parts.push(
      `${p.position.row},${p.position.col},${p.wallsRemaining},${p.goalDirection},${p.status}`
    );
  }
  for (const placement of state.placements) parts.push(`${placement.playerId}=${placement.place}`);
  return parts.join('|');
}

/**
 * Minimax with alpha-beta pruning, or Max-n in multiplayer.
 *
 * HEAD TO HEAD: classic alpha-beta, alternating maximise/minimise by whose turn
 * it is, with a transposition table keyed on the whole position.
 *
 * MULTIPLAYER: Max-n. Every seat optimises ITSELF, so an opponent picks the move
 * that is best for the opponent — including moves that help the opponent and
 * hurt the player we are root for. The old coalition model, where every non-root
 * seat minimised the root's score, made three-player searches lie: it assumed
 * rivals would block each other, and they never do. Here the value reported
 * upwards is still the root's, but the choice at each node belongs to the seat
 * whose turn it is. No window is used, so nothing can be pruned — which is why
 * multiplayer is depth-capped and leans on the time budget.
 */
function searchNode(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext
): number {
  if (depth <= 0 || state.status === 'COMPLETED') {
    return evaluateState(state, ctx.rootId, ctx.profile);
  }
  if (outOfTime(ctx)) {
    return evaluateState(state, ctx.rootId, ctx.profile);
  }
  ctx.nodes++;

  const board = boardOf(state);
  const key = transpositionKey(state, board);
  const hit = ctx.tt.get(key);
  if (hit && hit.depth >= depth) {
    if (hit.bound === 0) return hit.value;
    if (hit.bound === 1) {
      if (hit.value >= beta) return hit.value;
      if (hit.value > alpha) alpha = hit.value;
    } else {
      if (hit.value <= alpha) return hit.value;
      if (hit.value < beta) beta = hit.value;
    }
  }

  const mover = state.players[state.currentPlayerIndex];
  if (!mover) return evaluateState(state, ctx.rootId, ctx.profile);
  const own = routeOf(state, board, mover);
  const candidates = buildSearchCandidates(state, board, own, mover.id, ctx.profile);
  if (candidates.length === 0) return evaluateState(state, ctx.rootId, ctx.profile);

  let value: number;
  let bound: 0 | 1 | 2 = 0;

  if (!ctx.multiplayer) {
    const maximizing = mover.id === ctx.rootId;
    let best = maximizing ? -Infinity : Infinity;
    let cut = false;
    for (const candidate of candidates) {
      const applied = applyAction(state, candidate.action);
      if (!applied.success) continue;
      const nextMaximizing =
        applied.state.players[applied.state.currentPlayerIndex].id === ctx.rootId;
      const evaluation = searchNode(applied.state, depth - 1, alpha, beta, ctx);
      if (maximizing) {
        if (evaluation > best) best = evaluation;
        if (best > alpha) alpha = best;
      } else {
        if (evaluation < best) best = evaluation;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) {
        cut = true;
        break;
      }
      if (ctx.aborted) break;
    }
    if (best === -Infinity || best === Infinity) {
      return evaluateState(state, ctx.rootId, ctx.profile);
    }
    value = best;
    // No cut means the whole subtree was seen, so the value is exact.
    bound = cut ? (maximizing ? 1 : 2) : 0;
  } else {
    let bestMover = -Infinity;
    let reported: number | null = null;
    for (const candidate of candidates) {
      const applied = applyAction(state, candidate.action);
      if (!applied.success) continue;
      const rootValue = searchNode(applied.state, depth - 1, -Infinity, Infinity, ctx);
      // The mover's own evaluation decides which line is taken. Ties keep the
      // earlier candidate, and candidates are in a deterministic order.
      const moverValue = evaluateState(applied.state, mover.id, ctx.profile);
      if (reported === null || moverValue > bestMover + TIE_EPSILON) {
        bestMover = moverValue;
        reported = rootValue;
      }
      // A seat that can win takes the win and stops looking.
      if (bestMover >= MOVER_WIN_BAR || ctx.aborted) break;
    }
    if (reported === null) return evaluateState(state, ctx.rootId, ctx.profile);
    value = reported;
    bound = 0;
  }

  // Only a fully explored node may write: an aborted node's value came from a
  // truncated search and would poison every later probe.
  if (!ctx.aborted) {
    if (ctx.tt.size >= TT_LIMIT) ctx.tt.clear();
    ctx.tt.set(key, { depth, value, bound });
  }
  return value;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

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
  /** Reuse a tactical read instead of doing it again for this position. */
  tactical?: AiTactical;
  /**
   * Seeded jitter source. Jitter only happens when `deterministic` is not set,
   * so the search itself is always reproducible; supplying a seeded generator
   * keeps even the "easy" profile reproducible for a given position.
   */
  rng?: () => number;
}

/**
 * Scores every candidate action for a player (search + structural guidance).
 * Pure and deterministic when `deterministic` is set — used by both play (via
 * getBestAction) and the analysis engine (ranked alternatives, principal
 * variation).
 *
 * Returns candidates best-first, which the analysis engine relies on for "what
 * should I have played here".
 */
export function rankActions(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  opts: RankOptions = {}
): RankedAction[] {
  if (state.status !== 'IN_PROGRESS') return [];
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];

  const depth = Math.max(1, Math.floor(opts.depth ?? profile.depth));
  const tactical = opts.tactical ?? readTacticalState(state, playerId);

  // Searching deeper than the profile's own depth is bought with a smaller wall
  // allowance, not with more time: the extra ply is a refinement, and the
  // per-move budget is a promise to the UI thread.
  const searchProfile: AIProfile =
    depth > profile.depth
      ? {
          ...profile,
          maxCandidateWalls: Math.max(2, Math.floor(profile.maxCandidateWalls * DEEP_WALL_SHARE)),
        }
      : profile;

  // Fresh structural caches for this root turn. Everything below is a pure
  // function of `state`, so the epoch boundary can never leak a stale answer.
  beginEpoch();
  resetMobilityMemo();
  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const ctx = newSearchContext(state, playerId, searchProfile, opts.timeBudgetMs);
  lastSearchTruncated = false;
  const candidates = buildRootCandidates(
    state,
    board,
    own,
    playerId,
    searchProfile,
    tactical,
    ctx.deadline
  );
  if (candidates.length === 0) return [];

  let minOpponentDist = Infinity;
  for (const rival of state.players) {
    if (rival.id === playerId) continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess && route.distance < minOpponentDist) minOpponentDist = route.distance;
  }

  // Goal-directed guidance, computed once per turn from the optimal routes:
  // - onPath: the move starts an equally short route (there may be several).
  // - racing: this player is strictly closer to goal than every rival → just run.
  const racing = own.distance < minOpponentDist;
  const focus = 1 - profile.randomness;
  const perStep = profile.weights.pathDifference;

  // Whether this turn has a productive alternative. Walling only really costs
  // tempo when a step forward was available — when the route ahead is blocked
  // the turn was going to be spent shuffling anyway, so the wall is close to
  // free. Charging a full step unconditionally (an earlier attempt) made every
  // wall look like a clear loss, so the AI either refused to wall at all or, in
  // self-play, both seats walled constantly and the second mover won 100% of
  // games purely because the first was charged tempo for going first.
  // A legal move that is an optimal first step IS "a step forward existed".
  const hasProgressMove = candidates.some((c) => c.onPath);

  const jitter = !opts.deterministic && opts.rng !== undefined && profile.randomness > 0;

  const scored: Array<{
    action: GameAction;
    score: number;
    onPath: boolean;
    order: number;
  }> = [];
  for (const candidate of candidates) {
    // The clock is NOT re-checked here. Once the search has aborted, every
    // remaining `searchNode` call returns a static evaluation immediately, so
    // finishing the loop costs a millisecond — and stopping early would drop
    // whichever candidates happened to be sorted last. Candidates are ordered by
    // structural rank, so a truncated loop could drop a winning move in favour of
    // a wall, which is exactly the bug this used to have.
    const applied = applyAction(state, candidate.action);
    if (!applied.success) continue;
    const nextIsMaximizing =
      applied.state.players[applied.state.currentPlayerIndex].id === playerId;

    // Search value.
    let score = searchNode(applied.state, depth - 1, -Infinity, Infinity, ctx);
    if (jitter) {
      score += ((opts.rng as () => number)() - 0.5) * 2 * profile.randomness * 10;
    }

    if (candidate.action.type === 'MOVE') {
      // Prefer progress over shuffling back and forth. Scaled to a tie-breaker:
      // it must never outweigh a genuine step of progress, because when you are
      // walled in, shuffling is the *correct* play.
      score -= repetitionPenalty(state, playerId, candidate.action.to) * REPETITION_SCALE;
      if (candidate.onPath) score += ON_PATH_BONUS * focus;
      if (racing) score += RACING_BONUS * focus;
    } else if (candidate.wall) {
      const delay = candidate.wall.delay;

      // Charge the turn — but only if a forward step was actually available.
      // The leaf evaluation is turn-blind, so the search happily credits a wall
      // for pushing the opponent one step further away without accounting for
      // the step this wall gave up.
      if (hasProgressMove) score -= perStep;

      if (delay > 0) {
        // The delay is already in the search result. This is a horizon
        // correction only, and it is capped by what a delay is actually worth:
        //
        //   emergency  a rival one step from their line. Full weight, whatever
        //              the race looks like, because that is the one wall that
        //              changes the result.
        //   flip       the delay turns a race I was losing into one I am
        //              winning. Full weight.
        //   shrink     the delay cuts a deficit without flipping it. The rival
        //              moves next, so the race stays level: worth something,
        //              scaled by the size of the delay.
        //   already won  the delay cannot change the order at all, so it is
        //              worth NOTHING. Not a reduced rate: zero. A tempo charge
        //              is already being paid for the turn, and any credit on
        //              top of it lets a wall that cannot lose the game edge out
        //              simply walking home — which is how the AI ends up
        //              lengthening your path for twenty moves while it is eight
        //              steps ahead and winning.
        const emergency = minOpponentDist <= 1;
        const wasFirst = own.distance < minOpponentDist;
        const flips = !wasFirst && own.distance < minOpponentDist + delay;
        if (emergency) {
          score += Math.min(perStep * 3, delay * perStep) * 2.5 * focus;
        } else if (flips) {
          score += Math.min(perStep * 3, delay * perStep) * focus;
        } else if (!wasFirst) {
          score += Math.min(perStep * 3, delay * perStep) * 0.5 * focus;
        }
      }

      // Structure the search cannot see inside its horizon: a chain that will
      // exist next turn, a funnel being built, a seal being denied. Kept as a
      // share, so it refines the search rather than overruling it.
      score += candidate.wall.structure * STRUCTURE_SHARE;
    }

    scored.push({
      action: candidate.action,
      score,
      onPath: candidate.onPath,
      order: candidate.order,
    });
  }

  scored.sort((a, b) => {
    if (a.onPath !== b.onPath) return a.onPath ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.order - b.order;
  });
  if (ctx.aborted) lastSearchTruncated = true;
  lastSearchNodes += ctx.nodes;
  return scored.map(({ action, score }) => ({ action, score }));
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/** Deterministic 32-bit PRNG, so an "easy" AI is loose but still reproducible. */
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

/**
 * Seed derived from the position itself, so a game replays identically: the same
 * board and turn always produces the same "loose" choice, while different
 * positions still play differently from each other.
 */
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

/**
 * Picks the action to play from a best-first ranked list.
 *
 * Ties go to the earlier candidate, and the candidate order is a deterministic
 * total order, so there is no random tie-breaking anywhere. The only randomness
 * left is the difficulty's deliberate jitter, drawn from a seeded generator.
 */
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

/**
 * Safety margin on the iterative-deepening budget.
 *
 * The clock is honoured on entry to every node, so the search can still overshoot
 * by the cost of the node it is inside. Reserving a few percent up front is what
 * turns "about 120ms" into "never more than 120ms" on the JS thread, which is the
 * promise the UI actually relies on.
 */
const BUDGET_MARGIN = 0.94;

/**
 * What the last `getBestAction` call actually achieved.
 *
 * Nominal depth is a claim; this is the receipt. `depthReached` is the last ply
 * that COMPLETED, and `truncated` says whether the deepest ply the profile asked
 * for ran out of clock. A profile that reports `truncated: true` on most
 * positions is not searching that deep, however high its depth field is — which
 * is the failure mode worth being able to see.
 */
export interface AiSearchStats {
  /** Deepest ply that finished inside the budget. */
  depthReached: number;
  /** Deepest ply the profile and the tactical read asked for. */
  depthRequested: number;
  /** True when the clock cut the search short. */
  truncated: boolean;
  /** Search nodes visited across every ply. */
  nodes: number;
  /** Wall-clock cost of the whole call. */
  elapsedMs: number;
}

let lastSearchStats: AiSearchStats = {
  depthReached: 0,
  depthRequested: 0,
  truncated: false,
  nodes: 0,
  elapsedMs: 0,
};

/** Set by the innermost search of the ply in progress; read by getBestAction. */
let lastSearchTruncated = false;
let lastSearchNodes = 0;

export function searchStats(): AiSearchStats {
  return lastSearchStats;
}

/**
 * Selects the best action for the current AI player according to its profile.
 *
 * Iterative deepening: search one ply, then two, then three, stopping as soon as
 * a ply would exceed the time budget. The shallower plies are cheap and already
 * far stronger than a flat search, so a phone that can only afford depth 2 still
 * plays well — and it returns the completed result rather than a half-finished
 * tree.
 *
 * Depth is only raised where `readTacticalState` says the position deserves it,
 * and the extra ply is paid for with a smaller wall allowance, so the per-move
 * budget is a promise the AI keeps on a normal board too.
 */
export function getBestAction(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number
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
  // Max-n cannot prune, so multiplayer starts shallower and only spends the
  // extra ply on a position that is actually dangerous.
  const baseDepth = multiplayer ? Math.min(profile.depth, MULTIPLAYER_BASE_DEPTH) : profile.depth;
  const limit = multiplayer ? MULTIPLAYER_DEPTH_LIMIT : HEAD_TO_HEAD_DEPTH_LIMIT;
  const maxDepth = Math.max(1, Math.min(baseDepth + tactical.extraDepth, limit));
  lastSearchStats.depthRequested = maxDepth;
  const rng = makeRng(randomSeed ?? positionSeed(state, currentPlayer.index));

  const deadline = Date.now() + Math.max(1, Math.floor(profile.timeBudgetMs * BUDGET_MARGIN));
  let fallback: GameAction | null = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const started = Date.now();
    const ranked = rankActions(state, currentPlayer.id, profile, {
      depth,
      deterministic: true,
      tactical,
      rng,
      timeBudgetMs: Math.max(1, deadline - started),
    });
    if (ranked.length === 0) break;

    const best = pickBest(ranked, profile, rng);
    if (!best) break;
    fallback = best;
    // A ply only counts as reached if the search finished inside its slice.
    if (!lastSearchTruncated) lastSearchStats.depthReached = depth;
    if (Date.now() >= deadline) break;
  }
  lastSearchStats.nodes = lastSearchNodes;
  if (lastSearchStats.depthReached < maxDepth) lastSearchStats.truncated = true;

  lastSearchStats.elapsedMs = Date.now() - callStarted;
  return fallback;
}
