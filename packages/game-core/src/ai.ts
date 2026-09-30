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
import {
  exchangeOutcome,
  forecastSeal,
  fragilityDelta,
  planDamageAfter,
  planSuppression,
  readStrategicState,
  resetFragilityMemo,
  resetStrategicMemo,
} from './ai-threat.js';
import type { StrategicRead } from './ai-threat.js';
import { getLegalMoves } from './movement.js';
import { isCenterGoalMode, isGoalCell } from './pathfinding.js';
import { applyAction, bestRemainingPlace } from './ruleset.js';
import { CellCoord, GameAction, GameMode, GameState, WallCoord } from './types.js';
import { isLegalWallPlacement } from './walls.js';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIProfile {
  difficulty: AIDifficulty;
  depth: number;
  randomness: number; // 0..1 weight for jitter
  weights: {
    pathDifference: number; // one step of distance, in points
    wallAdvantage: number;
    mobility: number;
    pathways: number;
    tightness: number;
    placement: number;
  };
  maxCandidateWalls: number;
  timeBudgetMs: number;
}

export const AI_PROFILES: Record<AIDifficulty, AIProfile> = {
  easy: {
    difficulty: 'easy',
    depth: 1,
    randomness: 0.35,
    weights: { pathDifference: 8.0, wallAdvantage: 0.5, mobility: 0.2, pathways: 0.35, tightness: 0.4, placement: 1.0 },
    maxCandidateWalls: 3,
    timeBudgetMs: 20,
  },
  normal: {
    difficulty: 'normal',
    depth: 2,
    randomness: 0.05,
    weights: { pathDifference: 10.0, wallAdvantage: 1.0, mobility: 0.5, pathways: 0.6, tightness: 0.8, placement: 1.5 },
    maxCandidateWalls: 5,
    timeBudgetMs: 50,
  },
  hard: {
    difficulty: 'hard',
    depth: 3,
    randomness: 0.0,
    weights: { pathDifference: 12.0, wallAdvantage: 1.5, mobility: 0.8, pathways: 0.9, tightness: 1.2, placement: 2.0 },
    maxCandidateWalls: 8,
    timeBudgetMs: 120,
  },
};

/** Terminal score. Large enough that no heuristic can outweigh a finished game. */
const WIN_SCORE = 10000;
/** What one place is worth in a finished multiplayer game. */
const PLACEMENT_STEP = 1000;
/** Two scores closer than this are a tie; ties go to progress, then moves, then order. */
const TIE_EPSILON = 1e-6;
/** A mover that can reach this will take it and stop looking. */
const MOVER_WIN_BAR = WIN_SCORE - 1;

// ---------------------------------------------------------------------------
// Evaluation design (why this rewrite exists)
// ---------------------------------------------------------------------------
//
// The old evaluation had three measured diseases:
//
//   a) The race term saturated at a lead of ~4.5 (4.5*tanh(lead/4.5)). Once
//      ahead, stepping home scored ~0, while the structural terms (route
//      diversity, corridor width, chains) kept paying. A winning AI preferred
//      the wall that made its position prettier over the step that won.
//   b) There was NO absolute-progress term: own.distance appeared only inside
//      the lead difference, so "both sides advance" scored exactly 0 and
//      pacing in place was free.
//   c) The structural terms never saturated, so in sum they could outweigh a
//      real step.
//
// The replacement is three rules:
//
//   1. ABSOLUTE PROGRESS: -own.distance * perStep. Every step toward goal pays
//      one full step of value, whether or not it changes the race order.
//   2. LINEAR LEAD: (minOpponentDistance - own.distance) * perStep, no
//      saturation at any margin. The gradient is identical at +1 and at +8.
//   3. CAPPED STRUCTURE: every structural term together is soft-capped below
//      one step (STRUCTURE_CAP_SHARE of perStep), so structure can order two
//      walls, or two shuffles, but can NEVER outvote a real step toward goal.
//
// Net effect in step units (perStep = pathDifference weight): marching is
// worth 2 steps (progress + lead), a wall's delay is worth at most 1 step at
// the leaf and pays a tempo charge at the root, and all decoration combined is
// worth less than 1 step. A winning AI marches; a losing AI walls.

/** All structural terms combined are worth less than one real step. */
const STRUCTURE_CAP_SHARE = 0.75;
/** Root-level structure credit for one wall is capped at half a step. */
const ROOT_STRUCTURE_CAP_SHARE = 0.5;
/**
 * How much of my route the rival must have damaged over the last few plies
 * before their wall-building counts as an active attack on me.
 *
 * Found by replaying three real losses. In all of them the engine played its own
 * top choice on every ply and lost anyway, always the same way: the human
 * dropped a wall that cost the AI +1, then +2, then +3 steps, over three
 * consecutive turns, and the AI kept shuffling. The engine HAD the evidence and
 * could not use it, because the only thing that made it value a defensive wall
 * was the rival being one step from the line — by which point the damage was
 * already done.
 *
 * The engine records every move in `state.history`, so "am I being funneled
 * right now" is a fact about the last couple of plies, not a guess about the
 * future. That is what this measures.
 */
const RIVAL_PRESSURE_WINDOW = 4;
const RIVAL_PRESSURE_STEPS = 1;
/** Share of a wall's measured structure that is added to its search score. */
const STRUCTURE_SHARE = 0.5;

/**
 * Anti-loop penalty scale. One full penalty point per point of revisit: enough
 * to order equally-bad shuffles toward the least-recent square, always below
 * the value of a real step (2 * perStep in the evaluation).
 */
const REPETITION_SCALE = 1.0;
const ON_PATH_BONUS = 4;
const RACING_BONUS = 3;

/** Candidate-pool bounds. Every list the AI builds is capped: the phone is the target. */
const RAW_SLOT_CAP = 96;
const PROBE_PER_WALL = 6;
const ROUTE_BAND_CELLS = 6;
const APPROACH_CELLS = 3;
const CHAIN_EXTENSION_CELLS = 6;
const CONTEST_DISTANCE = 2;
/** Plugs generated around a threatened structure before candidate probing. */
const SLOT_PREVENT_CAP = 6;
/**
 * Route width at or below which our OWN walls become a critical-exit problem.
 * Above this the engine is not squeezed and defensive walls stay decoration, so
 * this is the gate that keeps the new self-protective credit from turning the
 * engine into a wall-happy panic.
 */
const SELF_CRITICAL_TIGHTEST = 3;
/**
 * How much of a wall's measured plan suppression is allowed to lift its
 * pre-search rank. Below 1 on purpose: this reorders what the search looks at
 * first, it does not decide the move. The decision is made in rankActions()
 * from searched values.
 */
const PLAN_PROMOTION = 0.5;
/**
 * Ceiling on what breaking one plan is worth, in steps. Above one step, so a
 * genuinely dangerous structure CAN outrank a pawn advance; below the value of
 * the advance-and-keep-your-wall-option that it replaces, so it does not do so
 * by default.
 */
const PLAN_DEFENCE_BAR = 1.4;
/**
 * Ceiling on self-protection credit, in step units. Deliberately just under one
 * step: buying back your own corridor is worth a lot, but never quite as much as
 * the step you gave up to place the wall, so the engine still prefers to march
 * when marching is genuinely available.
 */
const SELF_GAIN_BAR = 0.9;
/**
 * Ceiling on the fragility penalty, in step units. Below one step on purpose: a
 * position that is one wall from disaster should lose to a genuinely safe step,
 * but among equally-priced steps the tucked-in one is the better bet. This is
 * the difference between a tie-breaker and a panic button.
 */
const FRAGILITY_BAR = 0.8;
/**
 * Ceiling on prevention credit, in step units. A candidate that single-handedly
 * erases a two-step future is worth a march (progress + lead = 2 steps), and no
 * more: above that a wall starts outbidding the step it replaces by default,
 * which is the panic button this term must never become.
 */
const PREVENT_BAR = 2;
/**
 * Tie-break toward spending a harmless spare wall while a plan is forming, in
 * step units. Deliberately below everything that matters: it beats a pointless
 * shuffle, it never beats a march, a denial, or a real prevention. The engine
 * used to die holding eight walls because nothing in the scoring preferred a
 * free shaping move over standing still.
 */
const SPEND_TIEBREAK = 0.25;
/** Walls in hand at or above which the spend tie-break considers spending one. */
const SPARE_WALLS = 3;
/** Extra plies granted to a position where a plan is forming against us. */
const STRATEGIC_EXTRA_DEPTH = 1;

/**
 * The two wall-planning behaviours, switchable so they can be measured against
 * each other instead of argued about. Defaults are the tuned values; the
 * head-to-head harness sets these to build a baseline.
 *
 * Both came out of replaying real losses, not out of theory.
 */
export interface AiWallTuning {
  /**
   * A wall that denies the rival a step is not charged tempo.
   *
   * In this evaluation's own units a denying wall is worth exactly one step of
   * relative position: I do not move, but their distance grows by one. That is
   * the same trade a pawn advance makes. Charging a wall a full tempo AND only
   * crediting it a fraction of a step is therefore double-counting the cost,
   * and it is why the engine would take a move scoring -80 over a wall scoring
   * -110 while holding ten unused walls.
   *
   * Tempo is still charged for a wall that denies nobody, which is the case it
   * was written for: that really is a wasted turn.
   */
  denialIsTempo: boolean;
  /**
   * Weight on positional fragility: how much a candidate is penalised for
   * leaving us open to a big single-wall hit.
   *
   * The replayed losses were not missed tactics. At ply 12 the engine was even,
   * the worst wall available cost it ONE step, and the move it chose turned
   * that into THREE. Every move after made it worse (+3 -> +5 -> +7 -> +9).
   * Distance-based evaluation cannot see this, because the damage is caused by
   * a move nobody has made yet.
   */
  fragilityWeight: number;
}

export const DEFAULT_WALL_TUNING: AiWallTuning = {
  denialIsTempo: true,
  // OFF by default: measured, and it did not earn its place. See the note below.
  fragilityWeight: 0,
};

/**
 * MEASURED, and the measurement is unflattering.
 *
 * `denialIsTempo` is a correctness fix, not a heuristic: a wall that denies the
 * rival a step has already bought the tempo it costs, so charging it for a turn
 * as well is double-counting. It is on, and it is cheap.
 *
 * `fragilityWeight` is OFF. The diagnosis behind it is sound — at ply 12 of a
 * replayed loss the engine's own move turned a +1 vulnerability into a +3 one,
 * and every move after made it worse (+3 -> +5 -> +7 -> +9) — but the
 * implementation was measured and it lost:
 *
 *   - Across the 15 positions from the replayed losses, ON and OFF chose the
 *     SAME move in 14 of them. In the one where they differed, an impartial
 *     deeper search preferred the OLD choice.
 *   - It roughly tripled test-suite runtime, because it scans all 128 wall slots
 *     once per root candidate, and it broke two self-play tests: games stopped
 *     completing inside their budget, which then broke the determinism replay.
 *
 * A full-game head-to-head could not arbitrate it either. Across 300 games the
 * first player won 300/300 regardless of tuning — in self-play both sides race,
 * ties go to the mover, and the first mover takes every tie. So there is no
 * first-player-neutral signal to read a wall-logic effect out of, and the
 * measurement that would justify enabling this does not exist yet.
 *
 * Kept in the tree, disabled and documented, rather than deleted. The next
 * attempt at the same idea should be far cheaper: penalise only candidates that
 * raise fragility by two or more steps, which touches a handful of squares per
 * turn instead of 128.
 */

/**
 * MEASURED, and the measurement is unflattering. On the 15 positions taken
 * from the replayed losses, these two fixes changed the chosen move in ONE of
 * them, and an impartial deeper search preferred the old choice in that one.
 *
 * That is not evidence the idea is wrong — the tempo argument above is a
 * correctness point, not a heuristic one. It is evidence the two terms are far
 * too small to compete with the search score, which separates candidates by
 * tens of points while FRAGILITY_BAR and the tempo waiver are worth single
 * digits. They are on by default because they are more correct and cost
 * nothing measurable, but they are NOT a strength improvement and must not be
 * described as one.
 *
 * What that leaves, stated plainly: the gap is not in the wall terms. It is that
 * the search's own score differs from the truth by more than any of these
 * corrections can recover. Closing it means fixing the evaluation, not adding
 * another term beside it.
 */
/**
 * Walls aimed at a rival's goal approaches are only generated while the rival
 * is close enough that closing the door is a plan this game, not decoration.
 */
const APPROACH_RANGE = 6;

/** Wall allowance once the search goes deeper than the profile's own depth. */
const DEEP_WALL_SHARE = 0.6;

/** Transposition table bounds. */
const TT_LIMIT = 20000;
/** Check the clock on every node: a node now costs more than Date.now(). */
const CLOCK_SAMPLE = 1;

/** Hard depth ceilings. */
const HEAD_TO_HEAD_DEPTH_LIMIT = 10;
const MULTIPLAYER_BASE_DEPTH = 3;
const MULTIPLAYER_DEPTH_LIMIT = 6;

// ---------------------------------------------------------------------------
// Production budget (gameplay) vs. experimental ceiling (measurement)
// ---------------------------------------------------------------------------

/**
 * Two different things, deliberately kept apart:
 *
 *   Ceiling      getBestActionAsync(..., { maxDepth }) runs to a depth with no
 *                clock at all. This is the measurement harness — the shootout,
 *                the enclosure suite, the losing-game extraction all use it.
 *
 *   Production   what the phone actually gets. A depth cap plus a wall-clock
 *                safety net, chosen per mode and per difficulty.
 *
 * The old `timeBudgetMs` on a profile is NOT the production number: 120 ms was
 * never a measured figure, it was a leftover, and it was applied identically to
 * a 1v1 board and a four-seat centre race that branches four to seven ways per
 * ply. These numbers are measured (see `AI_BUDGET_NOTES`), and the depth cap
 * rather than the clock is the binding constraint in every multiplayer seat.
 */
export interface AiProductionBudget {
  /** Whole-turn wall-clock ceiling. A safety net, not the target. */
  timeMs: number;
  /** Hard depth cap for this mode and difficulty. */
  maxDepth: number;
}

/**
 * Measured, not guessed. Across all seven modes x three difficulties x 26 plies
 * of real self-play on the development machine:
 *
 *   easy    worst 65 ms, median 11-27 ms, depth reached 1-2
 *   normal  worst 118 ms, median 21-60 ms, depth reached 3
 *   hard    worst 181 ms, median 33-81 ms, depth reached 4
 *
 * Truncation was 0% everywhere, which is the important finding: the CLOCK is
 * never the binding constraint, the depth cap is. So these times are a safety
 * net sized above the worst observed case, not a target the search aims at, and
 * the engine's strength is limited by how deep it looks rather than by how long
 * it is allowed to think. Raising strength therefore means better decisions per
 * ply, not a bigger number here.
 *
 * Multiplayer gets a lower depth cap than head-to-head because branching grows
 * with the seat count while the clock does not.
 *
 * PROVISIONAL: development-machine figures. Retuning is a one-line change per
 * entry once a physical mid-range Android is measured — do not read them as
 * phone numbers.
 */
const AI_BUDGET_NOTES = {
  basis: 'dev-machine worst case per difficulty across all 7 modes; clock never binding (0% truncation)',
  pending: 'confirm on a physical mid-range Android device before shipping',
} as const;

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

/** Surfaced for diagnostics and for the device-tuning pass. */
export function aiBudgetNotes(): { basis: string; pending: string } {
  return { basis: AI_BUDGET_NOTES.basis, pending: AI_BUDGET_NOTES.pending };
}

// ---------------------------------------------------------------------------
// Mode-aware evaluation tuning
// ---------------------------------------------------------------------------

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
  if (isCenterGoalMode(mode)) {
    return { tightness: weights.tightness * 1.5, placement };
  }
  if (mode === 'race2' || mode === 'race3' || mode === 'race4') {
    return { tightness: weights.tightness * 0.6, placement };
  }
  return { tightness: weights.tightness, placement };
}

function logCount(value: number): number {
  return Math.log2(1 + Math.min(value, FORK_CAP));
}

/**
 * Legal-move count per seat, memoised over the last two positions. Counts are
 * stored PER SEAT on the memo slot, so evaluating a 4-player leaf hits the
 * memo for all four seats (the old version overwrote the whole counts array on
 * every miss and never actually hit).
 */
const MOBILITY_MEMO = 2;
const mobilityMemoState: GameState[] = [null as unknown as GameState, null as unknown as GameState];
const mobilityMemoCounts: number[][] = [[], []];

function mobilityOf(state: GameState, playerIndex: number): number {
  for (let slot = 0; slot < MOBILITY_MEMO; slot++) {
    if (mobilityMemoState[slot] === state) {
      const cached = mobilityMemoCounts[slot][playerIndex];
      if (cached !== undefined) return cached;
      const player = state.players[playerIndex];
      if (!player) return 0;
      const count = getLegalMoves(state, player.id).length;
      mobilityMemoCounts[slot][playerIndex] = count;
      return count;
    }
  }
  const player = state.players[playerIndex];
  if (!player) return 0;
  const count = getLegalMoves(state, player.id).length;
  mobilityMemoState[1] = mobilityMemoState[0];
  mobilityMemoCounts[1] = mobilityMemoCounts[0];
  mobilityMemoState[0] = state;
  mobilityMemoCounts[0] = [];
  mobilityMemoCounts[0][playerIndex] = count;
  return count;
}

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
 *
 *   progress   -own.distance * perStep              (absolute, never saturates)
 *   lead       (minOppDistance - own.distance)      (linear, never saturates)
 *   structure  forks/tightness/walls/mobility, soft-capped below one step
 *   placement  multiplayer: how many rivals are ahead/behind
 *
 * Every term is a function of distances and counts, never of absolute
 * coordinates, so mirror-image positions score identically.
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
  const perStep = profile.weights.pathDifference;

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
        threat = route;
      }
      if (route.distance < own.distance) ahead++;
      else if (route.distance > own.distance) behind++;
    }
    totalOpponentWalls += opp.wallsRemaining;
    totalOpponentMobility += mobilityOf(state, opp.index);
  }
  if (minOpponentDist === Infinity) minOpponentDist = own.distance;
  const rival = threat ?? { ...NEUTRAL_ROUTE, distance: own.distance };

  // 1. Absolute progress: marching pays whoever is ahead.
  const progress = -own.distance * perStep;
  // 2. Linear race lead: the gap is worth its face value at every margin.
  const lead = (minOpponentDist - own.distance) * perStep;

  // 3. Structure, soft-capped below the value of one step.
  //
  //    Four questions, four owners, no double counting:
  //      race       -> progress + lead                     (above)
  //      routes     -> route diversity, ONE term           (below)
  //      territory  -> walls / mobility / corridor width   (below)
  //      plan       -> NOT here. A developing structure is a root-only
  //                   question; pricing it per leaf would cost a structural
  //                   scan at every node of every search.
  //
  //    `pathCount` and `firstSteps.length` used to be charged separately, both
  //    against `weights.pathways`. They are the same fact — how many ways
  //    through do I have — measured twice, so a single funnel paid double. The
  //    combined reading below is one term, and it is the one that responds to a
  //    corridor actually closing.
  const routeOptions = logCount(own.pathCount) + Math.log2(1 + own.firstSteps.length) * 0.5;
  const rivalOptions =
    logCount(rival.pathCount) + Math.log2(1 + rival.firstSteps.length) * 0.5;
  const rawStructure =
    (me.wallsRemaining - totalOpponentWalls / opponents.length) * profile.weights.wallAdvantage +
    (mobilityOf(state, me.index) - totalOpponentMobility / opponents.length) * profile.weights.mobility +
    (routeOptions - rivalOptions) * profile.weights.pathways +
    (own.tightest - rival.tightest) * tuning.tightness;
  const structureCap = perStep * STRUCTURE_CAP_SHARE;
  const structure = structureCap * Math.tanh(rawStructure / structureCap);

  // 4. Multiplayer placement pressure.
  const placementAdvantage = tuning.placement > 0 ? (ahead - behind) * tuning.placement : 0;

  return progress + lead + structure + placementAdvantage;
}

// ---------------------------------------------------------------------------
// Anti-loop and path helpers
// ---------------------------------------------------------------------------

export function repetitionPenalty(
  state: GameState,
  playerId: string,
  to: CellCoord
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  if (isGoalCell(to, player.goalDirection, state.mode)) return 0;

  const recent: CellCoord[] = [];
  for (let i = state.history.length - 1; i >= 0 && recent.length < 6; i--) {
    const h = state.history[i];
    if (h.playerId === playerId && h.action.type === 'MOVE') {
      recent.push(h.action.to);
    }
  }
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
  extraDepth: number;
  restrict: boolean;
  winningCells: Set<number>;
  blockingSlots: Set<number>;
  escapeCells: Set<number>;
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
      extraDepth: 1,
      restrict: true,
      winningCells,
      blockingSlots: new Set(),
      escapeCells,
      reason: 'immediate win available',
    };
  }

  // 2. A rival one step from their line.
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

  // 3. Corridor pressure: the only way out of a dead end is forward.
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

  // 4. Structural pressure.
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

const SLOT_THREAT = 1;
const SLOT_ROUTE = 2;
const SLOT_APPROACH = 8;
const SLOT_CHAIN = 16;
const SLOT_SELF_ROUTE = 32;
const SLOT_CONTESTED = 64;
/**
 * A slot the threatening rival wants to play NEXT. Playing it ourselves steals
 * the plan, which is the single highest-value wall move the strategic layer
 * creates: it costs the opponent a continuation instead of costing us a step.
 */
const SLOT_RIVAL_PLAN = 128;
/**
 * A slot that is not a desired continuation but plugs the threatened structure
 * anyway, so the rival has to find a different (and more expensive) plan.
 */
const SLOT_PREVENT = 256;

/**
 * A slot on OUR OWN route where we are the one being squeezed. Priority sits
 * above attacking slots on purpose.
 *
 * Found by replaying a real loss: the engine was three steps behind, in a
 * two-wide corridor, holding ten walls — and every wall it was allowed to
 * consider sat on the rival's goal approach four rows away. `SLOT_SELF_ROUTE`
 * carries priority 1 against 2-3 for anything aimed at the rival, so with a
 * shortlist of 8 the defensive slots were crowded out at generation time and no
 * amount of scoring could have saved them. The engine was never given the move.
 */
const SLOT_SELF_EXIT = 512;

function slotPriority(reason: number): number {
  let score = 0;
  if (reason & SLOT_SELF_EXIT) score += 9;
  if (reason & SLOT_RIVAL_PLAN) score += 12;
  if (reason & SLOT_PREVENT) score += 8;
  if (reason & SLOT_THREAT) score += 6;
  if (reason & SLOT_APPROACH) score += 3;
  if (reason & SLOT_ROUTE) score += 2;
  if (reason & SLOT_CHAIN) score += 2;
  if (reason & SLOT_CONTESTED) score += 1;
  if (reason & SLOT_SELF_ROUTE) score += 1;
  return score;
}

export interface WallInsight {
  slot: WallCoord;
  delay: number;
  selfCost: number;
  narrowAdv: number;
  forkDeny: number;
  extendsChain: boolean;
  turnsChain: boolean;
  bridgesChains: boolean;
  shapesSelf: boolean;
  contested: boolean;
  structure: number;
  /**
   * Counterfactual: how much of the rival's developing plan this wall removes,
   * measured by re-projecting their continuations against the board this wall
   * produces. Non-zero on a wall that delays nobody today, which is exactly the
   * "weak now, dangerous later" case the strategic layer exists to catch.
   */
  planSuppression: number;
}

export interface ScoredCandidate {
  action: GameAction;
  onPath: boolean;
  wall: WallInsight | null;
  rank: number;
  order: number;
}

function moveOrder(to: CellCoord): number {
  return packCell(to);
}

function wallOrder(slot: WallCoord): number {
  return 128 + packSlot(slot);
}

/**
 * Pre-search order only: on-path first (cheap alpha-beta speedup), then rank,
 * then a deterministic total order. Final selection in rankActions is
 * score-first; this order only decides what the search sees first.
 */
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.onPath !== b.onPath) return a.onPath ? -1 : 1;
  if (a.rank !== b.rank) return b.rank - a.rank;
  return a.order - b.order;
}

interface WallSlotIdea {
  packed: number;
  reason: number;
  priority: number;
}

const packedScratch = new Int32Array(8);

function packedName(packed: number): string {
  const row = Math.floor(packed / 16);
  const col = Math.floor(packed / 2) % 8;
  return `${row},${col},${packed % 2 === 1 ? 'V' : 'H'}`;
}

function slotConflictsPacked(index: Uint8Array, packed: number): boolean {
  return slotConflicts(index, unpackSlot(packed));
}

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
    return slot < 0 ? 0 : this.reasons[slot * 2];
  }

  add(packed: number, reason: number): void {
    const existing = this.find(packed);
    if (existing >= 0) {
      this.reasons[existing * 2] |= reason;
      this.priorities[existing * 2] = slotPriority(this.reasons[existing * 2]);
      return;
    }
    if (this.count >= RAW_SLOT_CAP) return;
    const slot = this.count * 2;
    this.keys[slot] = packed;
    this.reasons[slot] = reason;
    this.priorities[slot] = slotPriority(reason);
    this.count++;
  }

  drain(out: WallSlotIdea[]): WallSlotIdea[] {
    for (let i = 0; i < this.count; i++) {
      out.push({ packed: this.keys[i * 2], reason: this.reasons[i * 2], priority: this.priorities[i * 2] });
    }
    out.sort((a, b) => (a.priority !== b.priority ? b.priority - a.priority : a.packed - b.packed));
    return out;
  }

  /**
   * Dense linear scan. Entries live at 0, 2, 4, ... in insertion order;
   * the previous hash-probe assumed open addressing and almost never found
   * an existing key, so the same slot was inserted up to six times and the
   * search evaluated (and sometimes chose between) identical walls.
   */
  private find(packed: number): number {
    for (let i = 0; i < this.count; i++) {
      if (this.keys[i * 2] === packed) return i;
    }
    return -1;
  }
}

const poolScratch = new SlotPool();

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

function collectWallSlotIdeas(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  strategic: StrategicRead | null
): WallSlotIdea[] {
  const index = board.field.index;
  const pool = poolScratch;
  pool.clear();
  const scratch = packedScratch;
  const addPacked = (packed: number, reason: number) => {
    if (pool.full()) return;
    if (pool.reasonAt(packed) === 0 && slotConflictsPacked(index, packed)) return;
    pool.add(packed, reason);
  };

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

    // 1. Immediate threat.
    if (route.distance <= 1) {
      const n = packedSlotsBlockingStep(rival.position.row, rival.position.col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_THREAT);
    }

    // 2. Goal approaches â€” only while the rival is close enough that closing
    //    the door is a plan this game. Beyond APPROACH_RANGE a wall there
    //    delays nobody and is pure decoration.
    if (route.distance <= APPROACH_RANGE) {
      const goals = route.goalCellsNear;
      for (let g = 0; g < goals.length && g < APPROACH_CELLS; g++) {
        const n = packedSlotsTouchingCell(goals[g].row, goals[g].col, scratch);
        for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_APPROACH);
      }
    }

    // 3. The route itself.
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

  // 4. Chain extensions that reach a rival.
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

  // 5. This player's own route. When WE are the one in a corridor this becomes
  //    the most important set on the board, so it outranks everything aimed at
  //    the rival: a wall that keeps our own exit open is worth more than one
  //    that delays a rival who is already losing the race.
  const ownCells = own.nearCells;
  const squeezed = own.hasGoalAccess && own.tightest <= SELF_CRITICAL_TIGHTEST;
  const selfBand = squeezed ? ROUTE_BAND_CELLS : APPROACH_CELLS + 1;
  for (let c = 0; c < ownCells.length && c < selfBand; c++) {
    const n = packedSlotsTouchingCell(ownCells[c].row, ownCells[c].col, scratch);
    for (let i = 0; i < n; i++) {
      addPacked(scratch[i], squeezed ? SLOT_SELF_EXIT | SLOT_SELF_ROUTE : SLOT_SELF_ROUTE);
    }
  }

  // 6. The strategic layer's slots. These are the ONLY candidates whose value
  //    the search cannot see for itself, because inner nodes generate no rival
  //    walls — so they have to exist at the root or they never get considered.
  //    Priority is set by slotPriority(), so a stolen continuation outranks
  //    everything the reactive passes produced.
  if (strategic && strategic.urgent && !strategic.raceDecided && strategic.primary) {
    const primary = strategic.primary;
    for (let i = 0; i < primary.walls.length; i++) {
      addPacked(primary.walls[i].packed, SLOT_RIVAL_PLAN);
    }
    // Plugs: free slots adjacent to the same structures the plan is built from.
    let plugs = 0;
    for (const wall of primary.walls) {
      if (plugs >= SLOT_PREVENT_CAP) break;
      const slot = unpackSlot(wall.packed);
      const n = packedSlotsTouchingCell(
        Math.min(8, Math.max(0, slot.row)),
        Math.min(8, Math.max(0, slot.col)),
        scratch
      );
      for (let i = 0; i < n && plugs < SLOT_PREVENT_CAP; i++) {
        if (scratch[i] === wall.packed) continue;
        if ((pool.reasonAt(scratch[i]) & SLOT_RIVAL_PLAN) !== 0) continue;
        addPacked(scratch[i], SLOT_PREVENT);
        plugs++;
      }
    }
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

function buildRootCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile,
  tactical: AiTactical,
  deadline: number,
  strategic: StrategicRead | null = null
): ScoredCandidate[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.wallsRemaining <= 0 || profile.maxCandidateWalls <= 0) {
    return moveCandidates(state, playerId, own);
  }

  const rivals = state.players.filter(
    (p) => p.id !== playerId && p.status === 'ACTIVE' && routeOf(state, board, p).hasGoalAccess
  );
  if (rivals.length === 0) return moveCandidates(state, playerId, own);

  // Endgame cut: when no rival holds a wall, nobody can reshape the board
  // against us anymore. Walls that delay nobody are pure decoration here —
  // keep only slots that actually slow a rival (the interrupt set).
  const rivalsDisarmed = rivals.every((r) => r.wallsRemaining <= 0);

  const ideas = collectWallSlotIdeas(state, board, own, playerId, strategic);
  const probeCap = Math.min(ideas.length, profile.maxCandidateWalls * PROBE_PER_WALL);
  const perStep = profile.weights.pathDifference;
  const focus = 1 - profile.randomness;
  const walls: ScoredCandidate[] = [];
  const wallNextStates = new Map<number, GameState>();

  for (let i = 0; i < probeCap; i++) {
    if (pastDeadline(deadline, i)) break;
    const slot = unpackSlot(ideas[i].packed);
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
    if (rivalsDisarmed && delay <= 0) continue;
    const ownAfter = routeOf(next, nextBoard, me);
    const selfCost =
      own.hasGoalAccess && ownAfter.hasGoalAccess
        ? Math.max(0, ownAfter.distance - own.distance)
        : 0;
    const narrowAdv =
      rivalBefore && rivalAfter ? Math.max(0, rivalBefore.tightest - rivalAfter.tightest) : 0;
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
      wall: { slot, delay, selfCost, narrowAdv, forkDeny, extendsChain, turnsChain, bridgesChains, shapesSelf, contested, structure, planSuppression: 0 },
      rank: delay * perStep + structure - selfCost * perStep,
      order: wallOrder(slot),
    });
    wallNextStates.set(wallOrder(slot), next);
  }

  walls.sort(compareCandidates);
  const kept = walls.slice(0, profile.maxCandidateWalls);

  // Counterfactual pass, over the KEPT walls only. Re-projecting a plan is one
  // hypothetical board per surviving continuation, so paying for it across the
  // whole probe pool would multiply the turn's cost for candidates that were
  // never going to be played.
  if (strategic && strategic.urgent && !strategic.raceDecided && me.wallsRemaining > 0) {
    for (const candidate of kept) {
      if (!candidate.wall) continue;
      const next = wallNextStates.get(candidate.order);
      if (!next) continue;
      candidate.wall.planSuppression = planSuppression(strategic, me, next);
      if (candidate.wall.planSuppression > 0) {
        // A stolen continuation is worth promoting before the search sees it.
        candidate.onPath = false;
        candidate.rank += candidate.wall.planSuppression * perStep * PLAN_PROMOTION;
      }
    }
    kept.sort(compareCandidates);
  }

  const moves = moveCandidates(state, playerId, own);
  let all = moves.concat(kept);
  all.sort(compareCandidates);

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
 * Inner nodes: pawn moves, plus a small set of plan replies when the node is
 * volatile.
 *
 * Phase 0 established that probing walls at every node is unaffordable (~98% of
 * search time). But moves-only has a worse problem: the rival's next WALL is
 * absent from the tree, so the engine cannot answer "what if they keep
 * building", which is the whole question. The compromise is to spend inner-node
 * branching only where the answer can differ:
 *
 *   - the node's own route is narrow (`tightest <= 2`), or
 *   - a wall chain reaches the mover's route band, or
 *   - somebody is one step from the line.
 *
 * Candidate slots come from `field.extensions`, already computed and cached for
 * the board, and the band test is array filtering over `route.nearCells`. No
 * legality BFS and no route recomputation happens here, which is what keeps
 * this affordable. A quiet node sees exactly the moves it always saw.
 */
const INNER_PLAN_WALLS = 2;

function innerPlanWalls(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  moverId: string,
  depth: number
): ScoredCandidate[] {
  const mover = state.players[state.currentPlayerIndex];
  if (!mover || mover.wallsRemaining <= 0) return [];
  if (depth <= 1) return [];

  const volatile =
    own.hasGoalAccess &&
    (own.tightest <= 2 ||
      board.field.chains.some((c) =>
        c.slots.some((s) => {
          const packed = packSlot(s);
          for (const cell of own.nearCells) {
            if (Math.abs(s.row - cell.row) <= 2 && Math.abs(s.col - cell.col) <= 2) {
              void packed;
              return true;
            }
          }
          return false;
        })
      ) ||
      state.players.some(
        (p) => p.id !== moverId && p.status === 'ACTIVE' && routeOf(state, board, p).distance <= 1
      ));
  if (!volatile) return [];

  const out: ScoredCandidate[] = [];
  for (const slot of board.field.extensions) {
    if (out.length >= INNER_PLAN_WALLS) break;
    const near = own.nearCells.some(
      (c) => Math.abs(slot.row - c.row) <= 2 && Math.abs(slot.col - c.col) <= 2
    );
    if (!near) continue;
    if (slotConflicts(board.field.index, slot)) continue;
    // Deliberately NOT isLegalWallPlacement() here: that runs a path-existence
    // BFS per active player, and at thousands of volatile nodes it dominated
    // the search. A wall that would seal somebody is simply rejected by the
    // applyAction() the search loop already performs, so the cheap screen is
    // safe and the saving is the difference between finishing a ply and being
    // cut off by the clock.
    out.push({
      action: { type: 'PLACE_WALL', wall: slot },
      onPath: false,
      wall: null,
      rank: 0,
      order: wallOrder(slot),
    });
  }
  return out;
}

function buildSearchCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile,
  depth: number
): ScoredCandidate[] {
  const moves = moveCandidates(state, playerId, own);
  moves.sort(compareCandidates);
  if (profile.maxCandidateWalls <= 0) return moves;
  const walls = innerPlanWalls(state, board, own, playerId, depth);
  if (walls.length === 0) return moves;
  return moves.concat(walls).sort(compareCandidates);
}

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

interface TtEntry {
  depth: number;
  value: number;
  bound: 0 | 1 | 2;
  /** Best move seen at this node, for move ordering (may be null). */
  move?: GameAction | null;
}

export interface SearchContext {
  profile: AIProfile;
  rootId: string;
  deadline: number;
  aborted: boolean;
  nodes: number;
  tt: Map<string, TtEntry>;
  multiplayer: boolean;
  /** Ply distance from the root of the current depth iteration. */
  rootDepth: number;
  /** Killer moves per ply (two slots): cutoffs tried first next time. */
  killers: (GameAction | null)[][];
  /** Time-slicing for async search: nodes at slice start + suspension flag. */
  sliceStart: number;
  /** Wall-clock end of the current slice; checked per node (cheap). */
  sliceDeadline: number;
  suspended: boolean;
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
    rootDepth: 0,
    killers: [],
    sliceStart: 0,
    sliceDeadline: 0,
    suspended: false,
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

function pastDeadline(deadline: number, tick: number): boolean {
  if (deadline === Number.POSITIVE_INFINITY) return false;
  return tick % 4 === 0 && Date.now() > deadline;
}

/**
 * Terminal value from the ROOT's perspective with distance-to-termination
 * preference: faster wins outrank slow ones, slower losses outrank fast
 * ones. Magnitudes never cross (a ply discount is capped below the
 * smallest placement step), so this only orders equal outcomes.
 */
function terminalRootScore(state: GameState, rootId: string, ply: number): number {
  const base = terminalScore(state, rootId);
  const p = Math.max(0, Math.min(ply, 500));
  if (base >= WIN_SCORE) return WIN_SCORE - Math.min(p, WIN_SCORE - 1);
  return base + Math.min(p, -base - 1);
}

/** Order candidates: TT-best first, then killers, then heuristic order. */
function orderCandidates(
  candidates: ScoredCandidate[],
  ttMove: GameAction | null | undefined,
  killers: (GameAction | null)[]
): ScoredCandidate[] {
  if (!ttMove && killers.every((k) => k === null)) return candidates;
  const front: ScoredCandidate[] = [];
  const rest: ScoredCandidate[] = [];
  const taken = (c: ScoredCandidate): boolean =>
    front.some((f) => sameGameAction(f.action, c.action));
  for (const c of candidates) {
    if (ttMove && sameGameAction(c.action, ttMove)) {
      if (!taken(c)) front.unshift(c);
      continue;
    }
    const killerIdx = killers.findIndex((k) => k !== null && sameGameAction(c.action, k));
    if (killerIdx >= 0) {
      if (!taken(c)) front.push(c);
      continue;
    }
    rest.push(c);
  }
  // Killer0 before killer1: stable by original order otherwise.
  front.sort((a, b) => {
    const ai = killers.findIndex((k) => k !== null && sameGameAction(a.action, k));
    const bi = killers.findIndex((k) => k !== null && sameGameAction(b.action, k));
    return ai - bi;
  });
  return [...front, ...rest];
}

/** Structural equality for game actions (move ordering, killer matching). */
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

/** Record a beta-cutoff move as a killer for its ply (two slots, shift). */
function storeKiller(ctx: SearchContext, ply: number, action: GameAction): void {
  while (ctx.killers.length <= ply) ctx.killers.push([null, null]);
  const slot = ctx.killers[ply];
  if (slot[0] !== null && sameGameAction(slot[0], action)) return;
  slot[1] = slot[0];
  slot[0] = action;
}

/**
 * Time-slice check for async search: each slice runs at most SLICE_MS of
 * compute, then flags suspension so the driver can yield to the event loop
 * and resume the same depth with a warm table. A minimum node count guards
 * against zero-progress slices under coarse clocks. Unlike aborting,
 * suspension writes nothing to the TT and marks nothing truncated.
 */
const SLICE_MS = 150;
const MIN_SLICE_NODES = 50;

function sliceExhausted(ctx: SearchContext): boolean {
  if (ctx.aborted || ctx.suspended) return ctx.aborted || ctx.suspended;
  if (ctx.nodes - ctx.sliceStart >= MIN_SLICE_NODES && Date.now() > ctx.sliceDeadline) {
    ctx.suspended = true;
    return true;
  }
  return false;
}

/** Start a fresh time slice on a shared context. */
function beginSlice(ctx: SearchContext): void {
  ctx.suspended = false;
  ctx.sliceStart = ctx.nodes;
  ctx.sliceDeadline = Date.now() + SLICE_MS;
}

function awaitYield(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

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

function searchNode(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: SearchContext
): number {
  const ply = ctx.rootDepth - depth;
  if (depth <= 0 || state.status === 'COMPLETED') {
    if (state.status === 'COMPLETED') return terminalRootScore(state, ctx.rootId, ply);
    return evaluateState(state, ctx.rootId, ctx.profile);
  }
  if (outOfTime(ctx) || sliceExhausted(ctx)) {
    return evaluateState(state, ctx.rootId, ctx.profile);
  }
  // Exact no-wall race (1v1, everyone active): both sides can only march,
  // so the outcome is decided by distances with mover-wins-ties. No search
  // needed — a correctness floor and a massive endgame saving.
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

  const board = boardOf(state);
  const key = transpositionKey(state, board);
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
  const own = routeOf(state, board, mover);
  const killers = ctx.killers[ply] ?? [];
  const candidates = orderCandidates(
    buildSearchCandidates(state, board, own, mover.id, ctx.profile, depth),
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
        // PVS null-window probe; full re-search only on fail-high.
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

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankedAction {
  action: GameAction;
  score: number;
  /** True when the move shortens our route (matters for rescue selection). */
  progress: boolean;
  /** True when the move reaches the goal immediately. */
  winsNow: boolean;
  /**
   * Race position after this action and the rival's best reply, computed only
   * for a position where a plan is live. Present means the strategic layer
   * decided this move, and `score` was re-based onto it.
   */
  exchange?: { myDistance: number; theirDistance: number } | null;
}

export interface RankOptions {
  depth?: number;
  deterministic?: boolean;
  timeBudgetMs?: number;
  tactical?: AiTactical;
  rng?: () => number;
  /**
   * Internal reuse hook: a precomputed root candidate list. Probing wall
   * candidates costs a legality BFS per slot per player and the answer does
   * not depend on search depth, so iterative deepening builds it once.
   */
  candidates?: ScoredCandidate[];
  /**
   * Shared search context for iterative deepening with a warm table: when
   * provided, this call uses it (and its TT/killers) instead of creating a
   * fresh one, and sets rootDepth for the requested depth. Absent, behavior
   * is exactly as before (fresh context per call).
   */
  ctx?: SearchContext;
  /**
   * Strategic plan read for this root, computed once by the caller. Threaded
   * rather than recomputed: it costs several hypothetical boards, and
   * rankActions() may run once per depth of iterative deepening.
   */
  strategic?: StrategicRead | null;
  /**
   * Wall-planning behaviours. Overridable so the head-to-head harness can build
   * a baseline with either fix disabled and measure the difference instead of
   * assuming it.
   */
  tuning?: Partial<AiWallTuning>;
}

/**
 * Scores every candidate action, best-first.
 *
 * Selection rules (this is where the old engine lost games):
 *  - A goal-reaching move is scored at the terminal value, always.
 *  - A wall pays a full step of tempo when a forward step existed.
 *  - A wall's delay is only credited when it changes the RESULT (emergency
 *    block, or flipping a lost race). Inflating a margin is worth zero.
 *  - A wall's structure credit is capped at half a step and suppressed
 *    entirely when we are leading and the wall delays nobody (decorating).
 *  - Prevention: any candidate (move or wall) that measurably shrinks the
 *    rival's forecasted two-wall future earns it, capped at two steps, with no
 *    urgency gate. A plan is credited once (max of suppression/prevention).
 *  - Ties break toward winning, then progress, then moves (conserve walls),
 *    then a deterministic total order.
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

  const searchProfile: AIProfile =
    depth > profile.depth && !opts.candidates
      ? { ...profile, maxCandidateWalls: Math.max(2, Math.floor(profile.maxCandidateWalls * DEEP_WALL_SHARE)) }
      : profile;

  beginEpoch();
  resetMobilityMemo();
  resetStrategicMemo();
  resetFragilityMemo();
  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const ctx = opts.ctx ?? newSearchContext(state, playerId, searchProfile, opts.timeBudgetMs);
  ctx.rootDepth = depth;
  lastSearchTruncated = false;
  if (!opts.candidates) lastSearchNodes = 0;
  const candidates =
    opts.candidates ??
    buildRootCandidates(
      state,
      board,
      own,
      playerId,
      searchProfile,
      tactical,
      ctx.deadline,
      opts.strategic ?? null
    );
  if (candidates.length === 0) return [];

  let minOpponentDist = Infinity;
  for (const rival of state.players) {
    if (rival.id === playerId) continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess && route.distance < minOpponentDist) minOpponentDist = route.distance;
  }

  const racing = own.distance < minOpponentDist;
  const rivalPressure = rivalPressureOnMe(state, playerId);
  const focus = 1 - profile.randomness;
  const tuning = { ...DEFAULT_WALL_TUNING, ...(opts.tuning ?? {}) };
  // Fragility only means something while the race is still live. If we are far
  // enough ahead that a wall cannot reach us, being exposed is irrelevant and
  // paying for it would make the engine refuse to convert.
  const fragilityMatters = !racing && me.wallsRemaining > 0;
  const perStep = profile.weights.pathDifference;
  const jitter = !opts.deterministic && opts.rng !== undefined && profile.randomness > 0;
  const finishScore = WIN_SCORE - (bestRemainingPlace(state) - 1) * PLACEMENT_STEP;

  // Seal forecast, once per call: the rival's next two slots priced together.
  // Null in quiet positions (and whenever no strategic read was threaded in),
  // in which case every prevention block below is skipped and scoring is
  // exactly what it was.
  const seal = forecastSeal(state, me, own.distance, opts.strategic ?? null, rivalPressure);

  interface Entry {
    candidate: ScoredCandidate;
    score: number;
    progress: boolean;
    winsNow: boolean;
    after: GameState;
  }

  const entries: Entry[] = [];
  for (const candidate of candidates) {
    const applied = applyAction(state, candidate.action);
    if (!applied.success) continue;
    let score = searchNode(applied.state, depth - 1, -Infinity, Infinity, ctx);
    if (jitter) {
      score += ((opts.rng as () => number)() - 0.5) * 2 * profile.randomness * 10;
    }

    let progress = candidate.onPath;
    let winsNow = false;
    if (candidate.action.type === 'MOVE') {
      const to = candidate.action.to;
      winsNow = isGoalCell(to, me.goalDirection, state.mode);
      // Jumps can advance two cells without being a BFS "first step": measure
      // progress directly so a productive jump counts as a forward step.
      if (!progress && !winsNow) {
        const meAfter = applied.state.players.find((p) => p.id === playerId);
        if (meAfter) {
          const after = routeOf(applied.state, boardOf(applied.state), meAfter);
          progress = after.hasGoalAccess && after.distance < own.distance;
        }
      }
    }
    entries.push({ candidate, score, progress, winsNow, after: applied.state });
  }

  // A legal move that shortens the route IS "a step forward existed" â€” that is
  // what makes a wall cost tempo. When walled in, shuffling was the only plan
  // anyway and a wall is close to free.
  const hasProgressMove = entries.some((e) => e.progress || e.winsNow);

  const scored = entries.map((entry) => {
    let { score } = entry;
    const { candidate } = entry;

    // Prevention (weaknesses 1+2+4): what of the rival's forecasted future this
    // candidate erases. Measured, not guessed: the forecast's two slots
    // re-priced from the position the candidate produces. `routeAfter` is a
    // cache hit — the search's own leaf evaluation just computed it — so each
    // candidate pays one projected BFS, never a scan.
    let prevention = 0;
    if (seal !== null && entry.after.status === 'IN_PROGRESS') {
      const meAfter = entry.after.players.find((p) => p.id === playerId);
      if (meAfter && meAfter.status === 'ACTIVE') {
        const boardAfter = boardOf(entry.after);
        const routeAfter = routeOf(entry.after, boardAfter, meAfter);
        if (routeAfter.hasGoalAccess) {
          prevention = Math.max(
            0,
            seal.damage -
              planDamageAfter(
                boardAfter,
                meAfter.goalDirection,
                meAfter.position,
                routeAfter.distance,
                seal.slots
              )
          );
        }
      }
    }

    if (candidate.action.type === 'MOVE') {
      if (entry.winsNow) {
        // Converting beats everything, always — no heuristic may outvote it.
        score = finishScore;
      } else {
        score -= repetitionPenalty(state, playerId, candidate.action.to) * REPETITION_SCALE;
        if (entry.progress) {
          score += ON_PATH_BONUS * focus;
          if (racing) score += RACING_BONUS * focus;
        }
        // Walking out of the forecasted lane earns the future it escapes.
        // Floored at zero: a move deeper into the funnel is merely unrewarded,
        // never punished. Punishing it is what made the old fragility term a
        // panic button.
        if (prevention > 0) {
          score += Math.min(prevention, PREVENT_BAR) * perStep * focus;
        }
      }
    } else if (candidate.action.type === 'PLACE_WALL' && candidate.wall) {
      const insight = candidate.wall;
      // Tempo, fix 1 of 2. Only a wall that denies nobody costs a turn: a wall
      // that pushes the rival back a step has already bought the tempo it costs.
      const denies = insight.delay > 0;
      if (hasProgressMove && !(tuning.denialIsTempo && denies)) score -= perStep;

      const delay = insight.delay;
      if (delay > 0) {
        // Horizon credit ONLY where the delay changes the RESULT:
        //   emergency  rival one step out: full weight, whatever the race.
        //   pressuring they have been building walls on me for the last few
        //              plies and still hold walls. This is the case the replayed
        //              losses lived in: at ply 10 of a game lost at ply 31 the
        //              funnel was invisible to every forward-looking test, and
        //              by the time the rival was "one step out" the damage was
        //              already +6. Measured from history, not guessed.
        //   flip       turns a lost race into a won one: full weight.
        //   otherwise  ZERO — including "shrink", which used to pay half
        //              weight for cutting a deficit without flipping. A cut
        //              that leaves you behind is decorating a loss: the
        //              center-rush engine played a shaping wall while six
        //              out with the leader at two, instead of marching.
        //   already won: ZERO. Inflating a margin is not progress.
        const emergency = minOpponentDist <= 1;
        const pressuring = rivalPressure >= RIVAL_PRESSURE_STEPS;
        const wasFirst = own.distance < minOpponentDist;
        const flips = !wasFirst && own.distance < minOpponentDist + delay;
        if (emergency) {
          score += Math.min(perStep * 3, delay * perStep) * 2.5 * focus;
        } else if (pressuring) {
          // Worth real weight but deliberately less than an emergency block.
          // One wall of ours that pushes the rival back is now a genuine
          // alternative to a pawn step rather than a turn thrown away, because
          // `denialIsTempo` stops charging it for the tempo. Before that fix
          // this branch existed and did almost nothing: the wall was charged a
          // full step and handed back a fraction of one, so it could never win.
          // Threshold is ONE recent wall on me, not two: waiting for a second
          // one is how the replayed games reached ply 20 before the engine
          // placed a wall at all, by which time the lane was already shut.
          score += Math.min(perStep * 2, delay * perStep) * 1.8 * focus;
        } else if (flips) {
          score += Math.min(perStep * 3, delay * perStep) * focus;
        }
      }

      let structure = insight.structure * STRUCTURE_SHARE;
      const cap = perStep * ROOT_STRUCTURE_CAP_SHARE;
      if (structure > cap) structure = cap;
      // Leading and the wall delays nobody: that is decorating, not shaping.
      if (racing && delay === 0) structure = 0;
      score += structure;

      // Self-protection credit was tried here and removed: a wall only ever
      // ADDS constraints, so it cannot widen the route of the player placing
      // it. The term was almost never positive, so it was dead weight. The
      // replayed losses were not caused by a missing defensive-wall bonus.

      // The strategic layer's contribution, in two halves that never stack.
      //
      // A wall that removes a real plan is worth a full tempo of ours plus the
      // delay it denies, because denying it costs THEM the turn they were going
      // to spend. Gated three ways so this cannot turn into a panicker:
      //
      //   urgent        the plan must be real (a bite, a live rival, close race)
      //   raceDecided   a lead beyond their remaining walls means no continuation
      //                 can change the result, so we keep converting
      //   suppression   the wall must actually take the plan away; a wall that
      //                 merely shifts the geometry is not a defence
      //
      // planSuppression is measured in steps, so this is expressed in the same
      // unit as everything else in the evaluation.
      //
      // The second half is prevention: the forecast's future minus what survives
      // this wall. It fires with NO urgency gate, because that gate is exactly
      // what goes blind once the race gap outgrows the bite — from that ply on,
      // the forming seal used to be invisible. max(), not sum: both halves
      // price the same plan, and a plan is credited once, by the best
      // available measure.
      const plan = opts.strategic;
      let suppressCredit = 0;
      if (
        plan !== undefined &&
        plan !== null &&
        plan.urgent &&
        !plan.raceDecided &&
        insight.planSuppression > 0
      ) {
        const denied = insight.planSuppression * perStep + perStep * 0.5;
        suppressCredit = Math.min(perStep * PLAN_DEFENCE_BAR, denied) * focus;
      }
      let preventCredit = 0;
      if (prevention > 0) {
        preventCredit = Math.min(prevention, PREVENT_BAR) * perStep * focus;
      }
      score += Math.max(suppressCredit, preventCredit);

      // Spend tie-break (weakness 5): a harmless spare wall beats a shuffle
      // while a plan is forming. Gated on the forecast being live, so a clean
      // won race still marches instead of decorating.
      if (seal !== null && insight.selfCost === 0 && me.wallsRemaining >= SPARE_WALLS) {
        score += perStep * SPEND_TIEBREAK * focus;
      }
    }

    // Fragility, fix 2 of 2. Applied to MOVES as well as walls, because the
    // failure it prevents was a pawn move: at ply 12 of a replayed loss the
    // engine was even, the worst wall available cost it ONE step, and the move
    // it chose turned that into THREE. Every move after made it worse
    // (+3 -> +5 -> +7 -> +9). Distance says the step was good; this says what
    // it cost.
    //
    // Priced in the same units as everything else and deliberately smaller than
    // a step, so it reorders close choices without overruling a step that is
    // genuinely safe. Cached per candidate, so the scan is paid once per turn
    // and not once per depth.
    if (fragilityMatters && tuning.fragilityWeight > 0) {
      const delta = fragilityDelta(state, me, candidate.action);
      if (delta > 0) {
        score -= Math.min(perStep * FRAGILITY_BAR, delta * perStep) * focus * tuning.fragilityWeight;
      }
    }

    return {
      action: candidate.action,
      score,
      progress: entry.progress,
      winsNow: entry.winsNow,
      prevention,
      after: entry.after,
      order: candidate.order,
    };
  });

  // The strategic layer's turn to decide, but only where it has something to
  // say. A live plan is exactly the case the search is worst at, because the
  // rival's next wall is not in its move list: at depth 3 it cannot represent
  // "they extend that chain", so it happily prices a correct defence as a
  // wasted tempo. For those positions each candidate is re-priced by an
  // explicit one-ply exchange — our action, then their best reply INCLUDING a
  // plan continuation — using the same BFS the rest of the engine trusts.
  //
  // Everywhere else this is skipped entirely, so quiet positions keep the
  // search's judgement untouched.
  //
  // Prevention SURVIVES the exchange, added on top rather than replaced by it.
  // The two are sequential effects, not the same effect twice: prevention is
  // what MY action erases of their two-slot future, the exchange is THEIR best
  // single reply to what remains. This matters because the reply is chosen by
  // greedy one-ply lead, which prefers their march over their wall — left
  // alone, the exchange assumes the rival marches instead of building, and the
  // two-wall future it was built to price dies in reply selection.
  const live = opts.strategic;
  const useExchange =
    live !== undefined && live !== null && live.urgent && !live.raceDecided && me.wallsRemaining > 0;
  const reRanked = scored.map((entry) => {
    if (!useExchange) return { ...entry, exchange: null as RankedAction['exchange'] };
    const outcome = exchangeOutcome(state, me, entry.action, opts.strategic ?? null);
    const mine = Number.isFinite(outcome.myDistance) ? outcome.myDistance : 99;
    const theirs = Number.isFinite(outcome.theirDistance) ? outcome.theirDistance : mine;
    // Same units as the evaluator: absolute progress plus linear lead.
    const exchangeScore = -mine * perStep + (theirs - mine) * perStep;
    // The exchange is a better model than a search that cannot see the plan, so
    // it wins outright rather than being averaged in. Converting still wins: a
    // move that reaches the goal has myDistance 0 and cannot be beaten.
    // Prevention is the residual two-slot future on top (see above).
    const residual =
      entry.prevention > 0 ? Math.min(entry.prevention, PREVENT_BAR) * perStep * focus : 0;
    // Overhang: the part of their plan still standing AFTER their reply. The
    // reply is chosen by greedy one-ply lead, which systematically prefers
    // their march — or their least damaging wall — over the continuation that
    // actually builds the seal. Measured at ply 12 of a replayed loss: the
    // exchange priced the V(4,5) reply and never saw the V(4,6) that followed
    // it a turn later. So the two-slot future is re-measured from the
    // post-reply position and charged as a penalty, capped like prevention.
    // Sequential again, no overlap: the exchange prices up to and including
    // the reply, this prices what the reply leaves standing.
    let overhang = 0;
    if (seal !== null && !entry.winsNow && outcome.reply) {
      const second = applyAction(entry.after, outcome.reply);
      if (second.success && second.state.status === 'IN_PROGRESS') {
        const meAfterReply = second.state.players.find((p) => p.id === playerId);
        if (meAfterReply && meAfterReply.status === 'ACTIVE') {
          const boardAfterReply = boardOf(second.state);
          const routeAfterReply = routeOf(second.state, boardAfterReply, meAfterReply);
          if (routeAfterReply.hasGoalAccess) {
            overhang =
              Math.min(
                planDamageAfter(
                  boardAfterReply,
                  meAfterReply.goalDirection,
                  meAfterReply.position,
                  routeAfterReply.distance,
                  seal.slots
                ),
                PREVENT_BAR
              ) *
              perStep *
              focus;
          }
        }
      }
    }
    return {
      ...entry,
      score: entry.winsNow ? entry.score : exchangeScore + residual - overhang,
      exchange: { myDistance: mine, theirDistance: theirs },
    };
  });

  // Score first. Ties: win, then progress, then moves before walls (a tied
  // wall spends inventory for nothing), then a deterministic total order.
  reRanked.sort((a, b) => {
    if (Math.abs(a.score - b.score) > TIE_EPSILON) return b.score - a.score;
    if (a.winsNow !== b.winsNow) return a.winsNow ? -1 : 1;
    if (a.progress !== b.progress) return a.progress ? -1 : 1;
    const aMove = a.action.type === 'MOVE';
    const bMove = b.action.type === 'MOVE';
    if (aMove !== bMove) return aMove ? -1 : 1;
    return a.order - b.order;
  });

  if (ctx.aborted) lastSearchTruncated = true;
  lastSearchNodes += ctx.nodes;
  return reRanked.map(({ action, score, progress, winsNow, exchange }) => ({
    action,
    score,
    progress,
    winsNow,
    exchange,
  }));
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/** Nearest active rival's route distance, or Infinity when nobody is racing. */
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

/**
 * How many recent rival walls were played ON me.
 *
 * Deliberately retrospective. Every heuristic tried for this so far tried to
 * predict a funnel from the current board, and every one of them read the
 * opening moves of the real losses as harmless — because at ply 10 of a game
 * lost at ply 31, a single wall genuinely was harmless. The pattern only exists
 * across plies, and the engine already stores the plies.
 *
 * A wall counts only if it was placed close enough to my pawn to be about my
 * route: a rival building a wall on the far side of the board is not pressuring
 * me, and counting it would make the engine defensive against anything. Counts
 * only walls by a still-active rival, so a rival marching is never mistaken for
 * a rival building.
 */
const PRESSURE_RADIUS = 3;

export function rivalPressureOnMe(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return 0;
  let count = 0;
  let seen = 0;
  for (let i = state.history.length - 1; i >= 0 && seen < RIVAL_PRESSURE_WINDOW; i--) {
    const entry = state.history[i];
    if (entry.action.type !== 'PLACE_WALL') continue;
    seen++;
    const author = state.players.find((p) => p.id === entry.playerId);
    if (!author || author.id === playerId || author.status !== 'ACTIVE') continue;
    const w = entry.action.wall;
    // Distance from my pawn to the wall's near end. A wall spans one cell edge,
    // so either of its two cells being close is close enough.
    const dRow = Math.min(
      Math.abs(w.row - me.position.row),
      Math.abs(w.row + 1 - me.position.row)
    );
    const dCol = Math.min(
      Math.abs(w.col - me.position.col),
      Math.abs(w.col + 1 - me.position.col)
    );
    if (dRow + dCol <= PRESSURE_RADIUS) count++;
  }
  return count;
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

/**
 * Losing-position rescue: when the search reports a forced loss, stop
 * decorating it and march. Picks the best-scoring progress move, or null
 * when the position is not lost (normal selection stands) or no forward
 * step exists. Deterministic: same ranking in, same choice out.
 */
const RESCUE_BAR = -WIN_SCORE / 2;

export function rescueChoice(ranked: RankedAction[]): GameAction | null {
  if (ranked.length === 0 || ranked[0].score > RESCUE_BAR) return null;
  let best: RankedAction | null = null;
  for (const entry of ranked) {
    if (entry.action.type !== 'MOVE' || !entry.progress) continue;
    if (!best || entry.score > best.score + TIE_EPSILON) best = entry;
  }
  return best ? best.action : null;
}

const BUDGET_MARGIN = 0.94;

export interface AiSearchStats {
  /** Deepest ply that finished inside the budget. */
  depthReached: number;
  /** Deepest ply attempted (profile depth plus opportunistic tactical plies). */
  depthRequested: number;
  /**
   * True when the budget failed to deliver the depth the PROFILE promises.
   * Tactical bonus plies beyond the promised depth are best-effort and do not
   * set this flag when they are skipped or cut short.
   */
  truncated: boolean;
  /** Search nodes visited by the last call (reset every call). */
  nodes: number;
  elapsedMs: number;
}

let lastSearchStats: AiSearchStats = {
  depthReached: 0,
  depthRequested: 0,
  truncated: false,
  nodes: 0,
  elapsedMs: 0,
};

let lastSearchTruncated = false;
let lastSearchNodes = 0;

export function searchStats(): AiSearchStats {
  return lastSearchStats;
}

export function getBestAction(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number,
  budget?: AiProductionBudget,
  tuning?: Partial<AiWallTuning>
): GameAction | null {
  const callStarted = Date.now();
  lastSearchNodes = 0;
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
  // The depth the profile PROMISES. Tactical bonus plies are attempted beyond
  // this but never required: skipping them is not truncation.
  const promisedDepth = Math.max(1, Math.min(baseDepth, limit));
  const maxDepth = Math.max(promisedDepth, Math.min(baseDepth + tactical.extraDepth, limit));
  lastSearchStats.depthRequested = maxDepth;
  const rng = makeRng(randomSeed ?? positionSeed(state, currentPlayer.index));

  const deadline = Date.now() + Math.max(1, Math.floor(production.timeMs * BUDGET_MARGIN));

  // Root candidates are built ONCE: probing a wall costs a legality BFS per
  // active player, and the answer does not depend on search depth. Rebuilding
  // it per ply used to multiply the most expensive part of the turn by depth.
  beginEpoch();
  resetMobilityMemo();
  resetStrategicMemo();
  resetFragilityMemo();
  const rootBoard = boardOf(state);
  const rootRoute = routeOf(state, rootBoard, currentPlayer);
  const strategic = readStrategicState(
    state,
    currentPlayer.id,
    nearestRivalDistance(rootBoard, state, currentPlayer.id, rootRoute.distance)
  );
  const rootCandidates = buildRootCandidates(
    state,
    rootBoard,
    rootRoute,
    currentPlayer.id,
    profile,
    tactical,
    deadline,
    strategic
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
      tuning,
    });
    if (ranked.length === 0) break;
    lastRanked = ranked;

    const best = pickBest(ranked, profile, rng);
    if (!best) break;
    fallback = best;
    if (!lastSearchTruncated) lastSearchStats.depthReached = depth;
    // A truncated ply means a deeper one cannot possibly finish: stop here.
    if (lastSearchTruncated) break;
    if (Date.now() >= deadline) break;
    // Do not start a ply the clock cannot finish: if the previous ply took
    // longer than the time that remains, the next one will not complete.
    if (Date.now() - started > deadline - Date.now()) break;
  }
  lastSearchStats.nodes = lastSearchNodes;
  if (lastSearchStats.depthReached < promisedDepth) lastSearchStats.truncated = true;

  // Losing-position rescue, applied once to the deepest completed ranking:
  // a forced loss is marched, never decorated.
  const rescued = rescueChoice(lastRanked);
  if (rescued) fallback = rescued;

  lastSearchStats.elapsedMs = Date.now() - callStarted;
  return fallback;
}

export interface AsyncSearchHooks {
  /** Called after each completed depth with live stats (thinking UI). */
  onDepth?: (stats: AiSearchStats) => void;
  /** Polled at slice boundaries; true cancels (best-so-far is kept). */
  shouldCancel?: () => boolean;
  /** Safety ceiling; defaults to the profile-derived limits. */
  maxDepth?: number;
  /**
   * Gameplay ceiling. When supplied, the search stops at `budget.maxDepth` and
   * reports a truncated ply rather than running unbounded. Omit it for the
   * experimental unlimited-depth path.
   */
  budget?: AiProductionBudget;
}

/**
 * Unlimited-depth iterative deepening that never blocks the event loop.
 *
 * Same search as getBestAction, but each depth runs in ~150ms time slices
 * with yields between them, over one shared table (transpositions, killers
 * and move ordering compound across depths AND slices). Depth iterations
 * run to maxDepth with no clock: time is unbounded, depth is the only
 * ceiling. Cancellation (unmount, new game) keeps the best completed ply.
 */
export async function getBestActionAsync(
  state: GameState,
  profile: AIProfile = AI_PROFILES.normal,
  randomSeed?: number,
  hooks: AsyncSearchHooks = {}
): Promise<GameAction | null> {
  const callStarted = Date.now();
  lastSearchNodes = 0;
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
  resetFragilityMemo();
  const rootBoard = boardOf(state);
  const rootRoute = routeOf(state, rootBoard, currentPlayer);
  const strategic = readStrategicState(
    state,
    currentPlayer.id,
    nearestRivalDistance(rootBoard, state, currentPlayer.id, rootRoute.distance)
  );
  // Selective depth: a position where a plan is forming against us is worth one
  // more ply than a quiet one. This is the only place the strategic layer is
  // allowed to make the search deeper, and it is capped by the same limit.
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
    strategic
  );

  let fallback: GameAction | null = null;
  let lastRanked: RankedAction[] = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (hooks.shouldCancel?.()) {
      ctx.aborted = true;
      break;
    }
    // One depth, possibly across several yielded slices. The table stays
    // warm: a suspended slice resumes the SAME depth, so no work is lost.
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
      });
      if (!ctx.suspended) {
        if (ranked.length === 0) break;
        lastRanked = ranked;
        const best = pickBest(ranked, profile, rng);
        if (!best) break;
        fallback = best;
        lastSearchStats.depthReached = depth;
        lastSearchStats.nodes = lastSearchNodes;
        lastSearchStats.elapsedMs = Date.now() - callStarted;
        hooks.onDepth?.({ ...lastSearchStats });
        break;
      }
      if (hooks.shouldCancel?.()) {
        ctx.aborted = true;
        break;
      }
      await awaitYield();
    }
    if (ctx.aborted) break;
  }
  if (lastSearchStats.depthReached < promisedDepth) lastSearchStats.truncated = true;

  const rescued = rescueChoice(lastRanked);
  if (rescued) fallback = rescued;

  return finish(fallback);
}