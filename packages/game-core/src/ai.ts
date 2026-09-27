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
const HEAD_TO_HEAD_DEPTH_LIMIT = 6;
const MULTIPLAYER_BASE_DEPTH = 3;
const MULTIPLAYER_DEPTH_LIMIT = 4;

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
  const rawStructure =
    (me.wallsRemaining - totalOpponentWalls / opponents.length) * profile.weights.wallAdvantage +
    (mobilityOf(state, me.index) - totalOpponentMobility / opponents.length) * profile.weights.mobility +
    (logCount(own.pathCount) - logCount(rival.pathCount)) * profile.weights.pathways +
    (own.tightest - rival.tightest) * tuning.tightness +
    (Math.log2(1 + own.firstSteps.length) - Math.log2(1 + rival.firstSteps.length)) *
      profile.weights.pathways * 0.5;
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
  playerId: string
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

  // 5. This player's own route (protected corridors; selfCost prices the rest).
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
      wall: { slot, delay, selfCost, narrowAdv, forkDeny, extendsChain, turnsChain, bridgesChains, shapesSelf, contested, structure },
      rank: delay * perStep + structure - selfCost * perStep,
      order: wallOrder(slot),
    });
  }

  walls.sort(compareCandidates);
  const kept = walls.slice(0, profile.maxCandidateWalls);

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

function buildSearchCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile
): ScoredCandidate[] {
  const me = state.players[state.currentPlayerIndex];
  const moves = moveCandidates(state, playerId, own);
  // Walls live at the ROOT only (buildRootCandidates, once per turn).
  // Probing wall ideas inside the tree was 98% of search time: every inner
  // node re-ran slot collection plus a legality BFS and a full structural
  // rebuild per wall child, so the budget died before the promised depth
  // and truncation (hence the chosen move) varied with machine load. Inner
  // replies are moves; wall threats are priced statically by the eval.
  moves.sort(compareCandidates);
  return moves;
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
}

interface SearchContext {
  profile: AIProfile;
  rootId: string;
  deadline: number;
  aborted: boolean;
  nodes: number;
  tt: Map<string, TtEntry>;
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

function pastDeadline(deadline: number, tick: number): boolean {
  if (deadline === Number.POSITIVE_INFINITY) return false;
  return tick % 4 === 0 && Date.now() > deadline;
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
      }
      if (bestMover >= MOVER_WIN_BAR || ctx.aborted) break;
    }
    if (reported === null) return evaluateState(state, ctx.rootId, ctx.profile);
    value = reported;
    bound = 0;
  }

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
  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const ctx = newSearchContext(state, playerId, searchProfile, opts.timeBudgetMs);
  lastSearchTruncated = false;
  if (!opts.candidates) lastSearchNodes = 0;
  const candidates =
    opts.candidates ??
    buildRootCandidates(state, board, own, playerId, searchProfile, tactical, ctx.deadline);
  if (candidates.length === 0) return [];

  let minOpponentDist = Infinity;
  for (const rival of state.players) {
    if (rival.id === playerId) continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess && route.distance < minOpponentDist) minOpponentDist = route.distance;
  }

  const racing = own.distance < minOpponentDist;
  const focus = 1 - profile.randomness;
  const perStep = profile.weights.pathDifference;
  const jitter = !opts.deterministic && opts.rng !== undefined && profile.randomness > 0;
  const finishScore = WIN_SCORE - (bestRemainingPlace(state) - 1) * PLACEMENT_STEP;

  interface Entry {
    candidate: ScoredCandidate;
    score: number;
    progress: boolean;
    winsNow: boolean;
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
    entries.push({ candidate, score, progress, winsNow });
  }

  // A legal move that shortens the route IS "a step forward existed" â€” that is
  // what makes a wall cost tempo. When walled in, shuffling was the only plan
  // anyway and a wall is close to free.
  const hasProgressMove = entries.some((e) => e.progress || e.winsNow);

  const scored = entries.map((entry) => {
    let { score } = entry;
    const { candidate } = entry;

    if (candidate.action.type === 'MOVE') {
      if (entry.winsNow) {
        // Converting beats everything, always â€” no heuristic may outvote it.
        score = finishScore;
      } else {
        score -= repetitionPenalty(state, playerId, candidate.action.to) * REPETITION_SCALE;
        if (entry.progress) {
          score += ON_PATH_BONUS * focus;
          if (racing) score += RACING_BONUS * focus;
        }
      }
    } else if (candidate.wall) {
      const insight = candidate.wall;
      if (hasProgressMove) score -= perStep; // tempo charge

      const delay = insight.delay;
      if (delay > 0) {
        // Horizon credit ONLY where the delay changes the result:
        //   emergency  rival one step out: full weight, whatever the race.
        //   flip       turns a lost race into a won one: full weight.
        //   otherwise  ZERO — including "shrink", which used to pay half
        //              weight for cutting a deficit without flipping. A cut
        //              that leaves you behind is decorating a loss: the
        //              center-rush engine played a shaping wall while six
        //              out with the leader at two, instead of marching.
        //   already won: ZERO. Inflating a margin is not progress.
        const emergency = minOpponentDist <= 1;
        const wasFirst = own.distance < minOpponentDist;
        const flips = !wasFirst && own.distance < minOpponentDist + delay;
        if (emergency) {
          score += Math.min(perStep * 3, delay * perStep) * 2.5 * focus;
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
    }

    return {
      action: candidate.action,
      score,
      progress: entry.progress,
      winsNow: entry.winsNow,
      order: candidate.order,
    };
  });

  // Score first. Ties: win, then progress, then moves before walls (a tied
  // wall spends inventory for nothing), then a deterministic total order.
  scored.sort((a, b) => {
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
  return scored.map(({ action, score }) => ({ action, score }));
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

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
  randomSeed?: number
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
  const baseDepth = multiplayer ? Math.min(profile.depth, MULTIPLAYER_BASE_DEPTH) : profile.depth;
  const limit = multiplayer ? MULTIPLAYER_DEPTH_LIMIT : HEAD_TO_HEAD_DEPTH_LIMIT;
  // The depth the profile PROMISES. Tactical bonus plies are attempted beyond
  // this but never required: skipping them is not truncation.
  const promisedDepth = Math.max(1, Math.min(baseDepth, limit));
  const maxDepth = Math.max(promisedDepth, Math.min(baseDepth + tactical.extraDepth, limit));
  lastSearchStats.depthRequested = maxDepth;
  const rng = makeRng(randomSeed ?? positionSeed(state, currentPlayer.index));

  const deadline = Date.now() + Math.max(1, Math.floor(profile.timeBudgetMs * BUDGET_MARGIN));

  // Root candidates are built ONCE: probing a wall costs a legality BFS per
  // active player, and the answer does not depend on search depth. Rebuilding
  // it per ply used to multiply the most expensive part of the turn by depth.
  beginEpoch();
  resetMobilityMemo();
  const rootBoard = boardOf(state);
  const rootRoute = routeOf(state, rootBoard, currentPlayer);
  const rootCandidates = buildRootCandidates(
    state,
    rootBoard,
    rootRoute,
    currentPlayer.id,
    profile,
    tactical,
    deadline
  );

  let fallback: GameAction | null = null;

  for (let depth = 1; depth <= maxDepth; depth++) {
    const started = Date.now();
    const ranked = rankActions(state, currentPlayer.id, profile, {
      depth,
      deterministic: true,
      tactical,
      rng,
      timeBudgetMs: Math.max(1, deadline - started),
      candidates: rootCandidates,
    });
    if (ranked.length === 0) break;

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

  lastSearchStats.elapsedMs = Date.now() - callStarted;
  return fallback;
}