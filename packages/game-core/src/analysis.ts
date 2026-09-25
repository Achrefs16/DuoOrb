/**
 * DuoOrb intelligent analysis engine — DATA LAYER ONLY (no UI, no colors,
 * no components). Everything here is deterministic given the same inputs,
 * engine version and profile: no Math.random, no LLM, no hallucination.
 * The game rules are never modified; every position comes from the
 * canonical game-core state transitions (applyAction).
 *
 * Versions:
 *   engineVersion: "duoorb-engine-1.0" (search + evaluation lineage)
 *   analysisVersion: "analysis-1.0" (this file's formulas)
 *
 * Calibration notes (all monotonic normalizations, NOT precise science):
 * - winChanceScale (20): evaluation gaps in DuoOrb typically span ±80
 *   (path steps are worth ~10). scale 20 maps +10 → 62%, +20 → 73%,
 *   +40 → 88%, 0 → 50%. Flat enough that ordinary opening marches do
 *   not read as critical swings. Documented approximation for readability.
 * - Classification bounds are on deterministic search-score loss
 *   (same units as the engine's own scores, roughly "steps × 10").
 * - Move accuracy curve acc = 100 * exp(-loss / 12): loss 0 → 100,
 *   4 → ~72, 8 → ~51, 20 → ~19. Forced lines always score 100.
 * - Multiplayer win chances are a softmax over per-player evaluations —
 *   a relative-standing approximation, not a true probability model.
 * - Deepening is time-boxed; `depthReached` records how far each dive got.
 *   Same version + profile + sufficient budget ⇒ same output.
 */
import { BOARD_SIZE } from './constants.js';
import {
  AI_PROFILES,
  RankedAction,
  evaluateState,
  rankActions,
} from './ai.js';
import type { AIProfile } from './ai.js';
import { getCellNeighbors } from './pathfinding.js';
import { getLegalMoves } from './movement.js';
import {
  getShortestDistance,
} from './pathfinding.js';
import { applyAction } from './ruleset.js';
import {
  CellCoord,
  GameAction,
  GameState,
  RecordedAction,
  WallCoord,
} from './types.js';

// ---------------------------------------------------------------------------
// Versions, config, profiles
// ---------------------------------------------------------------------------

export const ANALYSIS_ENGINE_VERSION = 'duoorb-engine-1.0';
export const ANALYSIS_VERSION = 'analysis-1.0';

/**
 * Every tunable threshold lives here with its rationale. Nothing is
 * scattered through the code, nothing is magic.
 */
export const ANALYSIS_CONFIG = {
  /** Eval units per e-fold in the win-chance logistic (see header). */
  winChanceScale: 20,
  /** Classification bounds on deterministic search-score loss. */
  classBounds: { best: 0.5, excellent: 1.5, good: 3.0, inaccuracy: 6.0, mistake: 12.0 },
  /** Score window inside which alternatives count as equivalent/best. */
  acceptableWindow: 0.5,
  /** Win-chance swing that forces at least MISTAKE. */
  criticalWinSwing: 0.2,
  /** Win-chance swing that marks a move critical. */
  criticalSwing: 0.15,
  /** Move-accuracy curve denominator (acc = 100 * e^(-loss/scale)). */
  accuracyScale: 12,
  /** Decisive-move counts for accuracy confidence low/medium/high. */
  confidenceDecisive: [4, 10] as const,
  /** Minimum games before a "leak" conclusion is allowed. */
  trendMinGames: 10,
  /** Issue rate above which a trend becomes a leak. */
  leakRateThreshold: 0.25,
  /** Flexibility counts cells within shortest+N. */
  flexibilitySlack: 2,
  /** Opponent-path gain that counts as a wall trap / serious threat. */
  wallTrapGain: 4,
  /** Threat gain used for the milder "creates pressure" flag. */
  threatGain: 3,
  /** Opponent distance at or below which there is an immediate threat. */
  threatDist: 1,
  /** Fraction of flexibility loss that counts as "options reduced". */
  optionsLossRatio: 0.25,
  /** Endgame gates: closest distance or average walls at/below these. */
  endgameDist: 2,
  endgameWalls: 1,
  /** Opening gates: wall ratio at/above this with distances at/above below. */
  openingWallRatio: 0.7,
  openingDist: 5,
  /** Rank-search LRU cache size. */
  cacheSize: 1000,
} as const;

export type AnalysisProfileName = 'fast' | 'normal' | 'deep';

export interface AnalysisProfile {
  /** Search depth used for the all-moves fast scan. */
  fastDepth: number;
  /** Deepest iterative-deepening level for suspicious moves. */
  deepMaxDepth: number;
  /** Time budget per deep-analyzed move (ms). */
  deepTimeMsPerMove: number;
  /** Max moves per game that get the deep treatment. */
  maxDeepDives: number;
  /** Ranked alternatives stored per move. */
  candidateCount: number;
  /** Whether to compute flood-based flexibility metrics. */
  advancedMetrics: boolean;
  /** Principal-variation plies for critical positions (0 = off). */
  pvPlies: number;
  /** Fast-scan loss that marks a move suspicious. */
  suspiciousLoss: number;
  /** Fast-scan win-chance swing that marks a move suspicious. */
  suspiciousSwing: number;
}

export const ANALYSIS_PROFILES: Record<AnalysisProfileName, AnalysisProfile> = {
  fast: {
    fastDepth: 2,
    deepMaxDepth: 2,
    deepTimeMsPerMove: 0,
    maxDeepDives: 0,
    candidateCount: 3,
    advancedMetrics: false,
    pvPlies: 0,
    suspiciousLoss: Infinity,
    suspiciousSwing: Infinity,
  },
  normal: {
    fastDepth: 2,
    deepMaxDepth: 4,
    deepTimeMsPerMove: 200,
    maxDeepDives: 6,
    candidateCount: 3,
    advancedMetrics: true,
    pvPlies: 4,
  suspiciousLoss: 3.0,
    suspiciousSwing: 0.08,
  },
  deep: {
    fastDepth: 3,
    deepMaxDepth: 5,
    deepTimeMsPerMove: 500,
    maxDeepDives: 12,
    candidateCount: 5,
    advancedMetrics: true,
    pvPlies: 6,
    suspiciousLoss: 1.5,
    suspiciousSwing: 0.05,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoveAssessment =
  | 'BEST'
  | 'EXCELLENT'
  | 'GOOD'
  | 'INACCURACY'
  | 'MISTAKE'
  | 'BLUNDER';

export type GamePhase = 'OPENING' | 'MIDGAME' | 'ENDGAME';

export type PlayerStanding =
  | 'winning'
  | 'advantage'
  | 'equal'
  | 'disadvantage'
  | 'losing'
  | 'critical';

export type MoveCategory =
  | 'PATH_ADVANCE'
  | 'PATH_DENIAL'
  | 'WALL_EFFICIENCY'
  | 'WALL_WASTE'
  | 'RACE_CONTROL'
  | 'TEMPO'
  | 'DEFENSIVE'
  | 'TACTICAL'
  | 'ESCAPE'
  | 'RESERVE'
  | 'OVERBLOCK'
  | 'PANIC_WALL'
  | 'RECOVERY'
  | 'WINNING_CONVERSION'
  | 'WAITING_MOVE';

export type CriticalReason =
  | 'RACE_REVERSAL'
  | 'MISSED_WIN'
  | 'MISSED_DEFENSE'
  | 'TRAP_CREATED'
  | 'GAME_WON'
  | 'GAME_LOST'
  | 'BIG_SWING';

export type ExplanationReason =
  | 'PATH_LOSS'
  | 'PATH_GAIN'
  | 'WALL_WASTE'
  | 'WALL_GOOD'
  | 'RACE_LOSS'
  | 'RACE_GAIN'
  | 'MISSED_DEFENSE'
  | 'MISSED_WIN'
  | 'LOW_MOBILITY'
  | 'TACTICAL'
  | 'RESOURCE_WASTE'
  | 'RECOVERY'
  | 'NEUTRAL';

export interface PlayerDistance {
  playerId: string;
  distance: number;
}

export interface MobilitySplit {
  normal: number;
  straightJump: number;
  diagonal: number;
}

export interface PositionMetrics {
  moverId: string;
  ownDistance: number;
  /** Every player's shortest distance (Infinity whenCut off — see hasPathToGoal guards in rules). */
  distances: PlayerDistance[];
  closestThreatId: string | null;
  closestThreatDistance: number;
  /** closestThreatDistance - ownDistance. Positive means ahead. */
  raceAdvantage: number;
  /** 1 = closest to goal (ties share rank). */
  moverRank: number;
  leaderId: string | null;
  ownWalls: number;
  avgOpponentWalls: number;
  wallDifferential: number;
  initialWalls: number;
  ownMobility: number;
  mobilityKinds: MobilitySplit;
  avgOpponentMobility: number;
  mobilityDifferential: number;
  /** 0..1 progress toward goal (8-cell crossing). */
  goalProgress: number;
  reachableCells: number;
  pathFlexibility: number;
  avgOpponentFlexibility: number;
  phase: GamePhase;
}

export interface WallImpact {
  opponentPathGain: number;
  ownPathCost: number;
  netPathImpact: number;
  wallCost: 1;
  createsNewThreat: boolean;
  reducesOpponentOptions: boolean;
  reducesOwnOptions: boolean;
  /** 0..100. 50 + 12*gain - 15*cost, clamped. Documented heuristic. */
  efficiencyScore: number;
  /** Scarcity context: (1 - remaining/initial), boosted late. */
  wallResourceValue: number;
}

export interface CandidateAction {
  action: GameAction;
  score: number;
  /** Mover-perspective evaluation after the move. */
  evaluation: number;
  /** Race-advantage change the move produces. */
  raceEffect: number;
  /** Opponent-path gain for walls, else 0. */
  wallEffect: number;
}

export interface ExplanationFacts {
  primaryReason: ExplanationReason;
  ownBefore: number;
  ownAfter: number;
  oppBefore: number;
  oppAfter: number;
  ownDistanceChange?: number;
  opponentDistanceChange?: number;
  wallCountChange?: number;
  mobilityChange?: number;
  raceChange?: number;
  raceBeforeText?: string;
  raceAfterText?: string;
  supportingFacts?: string[];
}

export interface MoveRegret {
  evaluationLoss: number;
  raceLoss: number;
  wallEfficiencyLoss: number;
  tacticalLoss: number;
  /** Heuristic composite: loss + 2*raceLoss + tacticalLoss. Documented, not scientific. */
  combined: number;
}

export interface VisualizationData {
  fromCell?: CellCoord;
  toCell?: CellCoord;
  wall?: WallCoord;
  bestFromCell?: CellCoord;
  bestToCell?: CellCoord;
  bestWall?: WallCoord;
  keyCells: CellCoord[];
}

export interface TryAgainData {
  stateBefore: GameState;
  playedAction: GameAction;
  bestAction: GameAction;
  acceptableActions: GameAction[];
  expectedEval: number;
}

export interface MoveAnalysis {
  // Legacy fields (kept byte-compatible for existing UI).
  step: number;
  playerId: string;
  playedAction: GameAction;
  evaluationBefore: number;
  evaluationAfter: number;
  evaluationDelta: number;
  bestAction: GameAction | null;
  bestActionEvaluation: number;
  assessment: MoveAssessment;
  explanation: string;
  // Intelligence layer.
  phase: GamePhase;
  before: PositionMetrics;
  after: PositionMetrics;
  evaluationLoss: number;
  regret: MoveRegret;
  winChanceBefore: number;
  winChanceAfter: number;
  winChanceSwing: number;
  raceSwing: number;
  wallImpact?: WallImpact;
  mobilityImpact: number;
  flexibilityImpact: number;
  bestActions: CandidateAction[];
  acceptableActions: GameAction[];
  forced: boolean;
  categories: { primary: MoveCategory; secondary?: MoveCategory };
  critical: boolean;
  criticalReason?: CriticalReason;
  criticalReasons: CriticalReason[];
  missedWin: boolean;
  missedDefense: boolean;
  raceReversal: boolean;
  badReversal: boolean;
  immediateThreat: boolean;
  playerStanding: PlayerStanding;
  explanationFacts: ExplanationFacts;
  principalVariation?: GameAction[];
  tryAgain?: TryAgainData;
  visualization: VisualizationData;
  moveAccuracy: number;
  depthReached: number;
}

export interface DecidingMoment {
  moveNumber: number;
  playerId: string;
  reason: CriticalReason | 'SWING';
  beforeWinChance: number;
  afterWinChance: number;
  evaluationSwing: number;
  raceSwing: number;
  importance: number;
  beforeState: GameState;
  afterState: GameState;
}

export interface Insight {
  title: string;
  detail: string;
  moveNumbers: number[];
}

export interface GameSummary {
  accuracy: Record<string, { accuracy: number; moves: number }>;
  confidence: 'low' | 'medium' | 'high';
  totalMoves: number;
  bestMoves: number;
  excellentMoves: number;
  goodMoves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  decidingMoment?: DecidingMoment;
  biggestStrengths: Insight[];
  biggestWeaknesses: Insight[];
  finalRaceAdvantage: number;
  avgWallEfficiency: number;
  wallWasteCount: number;
  panicWallCount: number;
  keyLesson: Insight;
}

export interface GameReview {
  // Legacy fields (kept byte-compatible for existing UI).
  totalMoves: number;
  winnerId: string | null;
  moveAnalyses: MoveAnalysis[];
  evaluationHistory: { step: number; evaluation: number }[];
  // Intelligence layer.
  engineVersion: string;
  analysisVersion: string;
  rulesetVersion: string;
  profile: AnalysisProfileName;
  winChanceHistory: { step: number; winChance: number; perPlayer?: Record<string, number> }[];
  decidingMoments: DecidingMoment[];
  summary: GameSummary;
}

export interface PositionReport {
  metrics: PositionMetrics;
  winChance: number;
  standing: PlayerStanding;
  phase: GamePhase;
  bestActions: CandidateAction[];
  immediateThreat: boolean;
}

export interface TrendReport {
  games: number;
  accuracyTrend: number[];
  wallEfficiencyTrend: number[];
  mistakeFrequency: number[];
  blunderFrequency: number[];
  leak?: string;
}

// ---------------------------------------------------------------------------
// Cache (keyed by canonical state hash — walls, positions, turn, ruleset)
// ---------------------------------------------------------------------------

const rankCache = new Map<string, RankedAction[]>();

function stateHash(state: GameState): string {
  return [
    state.rulesetVersion,
    state.mode,
    state.status,
    state.currentPlayerIndex,
    state.players
      .map((p) => `${p.id}:${p.position.row},${p.position.col}:${p.wallsRemaining}:${p.goalDirection}`)
      .join('|'),
    state.walls.map((w) => `${w.row},${w.col},${w.orientation}`).join('|'),
  ].join('#');
}

function weightsKey(profile: AIProfile): string {
  return JSON.stringify({ w: profile.weights, m: profile.maxCandidateWalls });
}

function cachedRank(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  depth: number
): RankedAction[] {
  const key = `${ANALYSIS_ENGINE_VERSION}|${stateHash(state)}|${playerId}|d${depth}|${weightsKey(profile)}`;
  const hit = rankCache.get(key);
  if (hit) return hit;
  const ranked = rankActions(state, playerId, profile, { depth, deterministic: true });
  rankCache.set(key, ranked);
  if (rankCache.size > ANALYSIS_CONFIG.cacheSize) {
    const oldest = rankCache.keys().next();
    if (!oldest.done) rankCache.delete(oldest.value);
  }
  return ranked;
}

/** Iterative deepening within a time budget. Returns the last completed depth. */
function deepRank(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  startDepth: number,
  maxDepth: number,
  timeLimitMs: number
): { ranked: RankedAction[]; depthReached: number } {
  let ranked = cachedRank(state, playerId, profile, startDepth);
  let depthReached = startDepth;
  if (maxDepth <= startDepth || timeLimitMs <= 0) return { ranked, depthReached };
  const t0 = Date.now();
  for (let d = startDepth + 1; d <= maxDepth; d++) {
    if (Date.now() - t0 > timeLimitMs) break;
    ranked = cachedRank(state, playerId, profile, d);
    depthReached = d;
    if (Date.now() - t0 > timeLimitMs) break;
  }
  return { ranked, depthReached };
}

/** Short principal variation for critical positions (bounded plies). */
function buildPV(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  depth: number,
  plies: number
): GameAction[] {
  const pv: GameAction[] = [];
  let cur = state;
  let pid = playerId;
  for (let i = 0; i < plies; i++) {
    if (cur.status !== 'IN_PROGRESS') break;
    const ranked = cachedRank(cur, pid, profile, depth);
    if (ranked.length === 0) break;
    const top = ranked[0].action;
    pv.push(top);
    const res = applyAction(cur, top);
    if (!res.success) break;
    cur = res.state;
    if (cur.status !== 'IN_PROGRESS') break;
    pid = cur.players[cur.currentPlayerIndex].id;
  }
  return pv;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Walls-only flood from a square: cell index -> depth. Deterministic. */
function floodDepths(start: CellCoord, walls: WallCoord[]): Map<number, number> {
  const depths = new Map<number, number>();
  const key = (r: number, c: number) => r * BOARD_SIZE + c;
  const queue: CellCoord[] = [{ ...start }];
  depths.set(key(start.row, start.col), 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = depths.get(key(cur.row, cur.col))!;
    for (const next of getCellNeighbors(cur, walls)) {
      const k = key(next.row, next.col);
      if (!depths.has(k)) {
        depths.set(k, d + 1);
        queue.push(next);
      }
    }
  }
  return depths;
}

function classifyPhase(avgWalls: number, minDist: number, initialAvg: number): GamePhase {
  if (minDist <= ANALYSIS_CONFIG.endgameDist || avgWalls <= ANALYSIS_CONFIG.endgameWalls) {
    return 'ENDGAME';
  }
  if (avgWalls >= ANALYSIS_CONFIG.openingWallRatio * initialAvg && minDist >= ANALYSIS_CONFIG.openingDist) {
    return 'OPENING';
  }
  return 'MIDGAME';
}

function classifyMoveKind(from: CellCoord, to: CellCoord): keyof MobilitySplit {
  const manhattan = Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
  if (manhattan === 1) return 'normal';
  if (from.row === to.row || from.col === to.col) return 'straightJump';
  return 'diagonal';
}

export function computePositionMetrics(
  state: GameState,
  playerId: string,
  initialWalls = 10,
  initialAvgWalls?: number
): PositionMetrics {
  const mover = state.players.find((p) => p.id === playerId) ?? state.players[state.currentPlayerIndex];
  const opponents = state.players.filter((p) => p.id !== mover.id);

  const distOf = (pos: CellCoord, goal: typeof mover.goalDirection): number => {
    return getShortestDistance(pos, goal, state.walls, state.mode);
  };

  const distances = state.players.map((p) => ({
    playerId: p.id,
    distance: distOf(p.position, p.goalDirection),
  }));
  const finite = (d: number) => (Number.isFinite(d) ? d : 999);
  const ownDistance = finite(distances.find((d) => d.playerId === mover.id)?.distance ?? Infinity);

  let closestThreatId: string | null = null;
  let closestThreatDistance = Infinity;
  for (const d of distances) {
    if (d.playerId !== mover.id && finite(d.distance) < closestThreatDistance) {
      closestThreatDistance = d.distance;
      closestThreatId = d.playerId;
    }
  }
  if (closestThreatId === null) closestThreatDistance = ownDistance;

  const moverRank = 1 + distances.filter((d) => finite(d.distance) < ownDistance).length;
  // Contested ties belong to nobody: lead → tie and tie → lead both count
  // as race reversals. Documented tie rule.
  const leaderId = (() => {
    let best: string | null = null;
    let bestDist = Infinity;
    let tied = false;
    for (const d of distances) {
      const fd = finite(d.distance);
      if (fd < bestDist) {
        bestDist = fd;
        best = d.playerId;
        tied = false;
      } else if (fd === bestDist) {
        tied = true;
      }
    }
    return tied ? null : best;
  })();

  const moverMoves = getLegalMoves(state, mover.id);
  const mobilityKinds: MobilitySplit = { normal: 0, straightJump: 0, diagonal: 0 };
  for (const m of moverMoves) mobilityKinds[classifyMoveKind(mover.position, m)] += 1;

  let oppMobilitySum = 0;
  const oppFlex: number[] = [];
  for (const o of opponents) {
    oppMobilitySum += getLegalMoves(state, o.id).length;
    const flood = floodDepths(o.position, state.walls);
    const od = finite(distances.find((d) => d.playerId === o.id)?.distance ?? Infinity);
    let flex = 0;
    for (const depth of flood.values()) {
      if (depth <= od + ANALYSIS_CONFIG.flexibilitySlack) flex += 1;
    }
    oppFlex.push(flex);
  }
  const avgOpponentMobility = opponents.length > 0 ? oppMobilitySum / opponents.length : 0;
  const avgOpponentFlexibility =
    oppFlex.length > 0 ? oppFlex.reduce((a, b) => a + b, 0) / oppFlex.length : 0;

  const flood = floodDepths(mover.position, state.walls);
  const reachableCells = flood.size;
  let pathFlexibility = 0;
  for (const depth of flood.values()) {
    if (depth <= ownDistance + ANALYSIS_CONFIG.flexibilitySlack) pathFlexibility += 1;
  }

  const allWalls = state.players.map((p) => p.wallsRemaining);
  const avgWalls = allWalls.reduce((a, b) => a + b, 0) / Math.max(1, allWalls.length);
  const allDists = distances.map((d) => finite(d.distance));
  const minDist = Math.min(...allDists);
  const phase = classifyPhase(avgWalls, minDist, initialAvgWalls ?? Math.max(initialWalls, 1));

  const maxCross = BOARD_SIZE - 1;
  const goalProgress = Math.max(0, Math.min(1, (maxCross - ownDistance) / maxCross));

  return {
    moverId: mover.id,
    ownDistance,
    distances,
    closestThreatId,
    closestThreatDistance: Number.isFinite(closestThreatDistance) ? closestThreatDistance : 999,
    raceAdvantage: closestThreatDistance - ownDistance,
    moverRank,
    leaderId,
    ownWalls: mover.wallsRemaining,
    avgOpponentWalls:
      opponents.length > 0
        ? opponents.reduce((a, o) => a + o.wallsRemaining, 0) / opponents.length
        : 0,
    wallDifferential:
      mover.wallsRemaining -
      (opponents.length > 0
        ? opponents.reduce((a, o) => a + o.wallsRemaining, 0) / opponents.length
        : 0),
    initialWalls,
    ownMobility: moverMoves.length,
    mobilityKinds,
    avgOpponentMobility,
    mobilityDifferential: moverMoves.length - avgOpponentMobility,
    goalProgress,
    reachableCells,
    pathFlexibility,
    avgOpponentFlexibility,
    phase,
  };
}

export function computeWallImpact(
  before: PositionMetrics,
  after: PositionMetrics
): WallImpact {
  const opponentPathGain = after.closestThreatDistance - before.closestThreatDistance;
  const ownPathCost = after.ownDistance - before.ownDistance;
  const efficiencyScore = Math.max(
    0,
    Math.min(100, 50 + 12 * opponentPathGain - 15 * Math.max(0, ownPathCost))
  );
  const scarcity = 1 - after.ownWalls / Math.max(1, after.initialWalls);
  const late = after.phase === 'ENDGAME' || after.closestThreatDistance <= 3 ? 1.5 : 1;
  return {
    opponentPathGain,
    ownPathCost,
    netPathImpact: opponentPathGain - ownPathCost,
    wallCost: 1,
    createsNewThreat: opponentPathGain >= ANALYSIS_CONFIG.threatGain,
    reducesOpponentOptions:
      before.avgOpponentFlexibility > 0 &&
      after.avgOpponentFlexibility <=
        (1 - ANALYSIS_CONFIG.optionsLossRatio) * before.avgOpponentFlexibility,
    reducesOwnOptions:
      before.pathFlexibility > 0 &&
      after.pathFlexibility <= (1 - ANALYSIS_CONFIG.optionsLossRatio) * before.pathFlexibility,
    efficiencyScore,
    wallResourceValue: scarcity * late,
  };
}

// ---------------------------------------------------------------------------
// Win chance (documented monotonic normalizations, not precise science)
// ---------------------------------------------------------------------------

export function winChanceFromEval(evaluation: number): number {
  return 1 / (1 + Math.exp(-evaluation / ANALYSIS_CONFIG.winChanceScale));
}

/** Relative standing for multiplayer: softmax over per-player evaluations. */
export function multiWinChances(state: GameState): Record<string, number> {
  const evals = state.players.map((p) => ({
    id: p.id,
    e: evaluateState(state, p.id, AI_PROFILES.normal),
  }));
  const m = Math.max(...evals.map((x) => x.e));
  const exps = evals.map((x) => ({
    id: x.id,
    v: Math.exp((x.e - m) / ANALYSIS_CONFIG.winChanceScale),
  }));
  const sum = exps.reduce((a, b) => a + b.v, 0) || 1;
  const out: Record<string, number> = {};
  for (const x of exps) out[x.id] = x.v / sum;
  return out;
}

function winChanceFor(state: GameState, playerId: string): number {
  if (state.players.length <= 2) {
    return winChanceFromEval(evaluateState(state, playerId, AI_PROFILES.normal));
  }
  return multiWinChances(state)[playerId] ?? 0;
}

function playerStanding(winChance: number, immediateThreat: boolean, alreadyWon: boolean): PlayerStanding {
  if (alreadyWon) return 'winning';
  if (immediateThreat && winChance < 0.5) return 'critical';
  if (winChance >= 0.7) return 'winning';
  if (winChance >= 0.57) return 'advantage';
  if (winChance > 0.43) return 'equal';
  if (winChance > 0.3) return 'disadvantage';
  if (winChance > 0.15) return 'losing';
  return 'losing';
}

// ---------------------------------------------------------------------------
// Tactical detection (all from canonical transitions + legal-move queries)
// ---------------------------------------------------------------------------

/** Immediate winning move targets for a player (moves only — walls never win on the spot). */
function immediateWinningTargets(state: GameState, playerId: string): CellCoord[] {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx < 0 || state.status !== 'IN_PROGRESS') return [];
  const sim: GameState = { ...state, currentPlayerIndex: idx };
  const wins: CellCoord[] = [];
  for (const to of getLegalMoves(sim, playerId)) {
    const res = applyAction(sim, { type: 'MOVE', to });
    if (res.success && res.state.status === 'COMPLETED' && res.state.winnerId === playerId) {
      wins.push(to);
    }
  }
  return wins;
}

function oppCanWinNext(state: GameState, moverId: string): boolean {
  for (const p of state.players) {
    if (p.id === moverId) continue;
    if (immediateWinningTargets(state, p.id).length > 0) return true;
  }
  return false;
}

function describeRace(adv: number): string {
  if (adv > 0) return adv === 1 ? 'a 1-step lead' : `a ${adv}-step lead`;
  if (adv < 0) {
    const n = -adv;
    return n === 1 ? '1 step behind' : `${n} steps behind`;
  }
  return 'an even race';
}

// ---------------------------------------------------------------------------
// Classification, categories, explanations
// ---------------------------------------------------------------------------

type AssessmentRank = Record<MoveAssessment, number>;
const ASSESSMENT_RANK: AssessmentRank = {
  BEST: 0,
  EXCELLENT: 1,
  GOOD: 2,
  INACCURACY: 3,
  MISTAKE: 4,
  BLUNDER: 5,
};
const RANK_ASSESSMENT: MoveAssessment[] = [
  'BEST',
  'EXCELLENT',
  'GOOD',
  'INACCURACY',
  'MISTAKE',
  'BLUNDER',
];
const worseThan = (a: MoveAssessment, b: MoveAssessment): MoveAssessment =>
  RANK_ASSESSMENT[Math.max(ASSESSMENT_RANK[a], ASSESSMENT_RANK[b])];

function baseAssessment(loss: number): MoveAssessment {
  const b = ANALYSIS_CONFIG.classBounds;
  if (loss <= b.best) return 'BEST';
  if (loss <= b.excellent) return 'EXCELLENT';
  if (loss <= b.good) return 'GOOD';
  if (loss <= b.inaccuracy) return 'INACCURACY';
  if (loss <= b.mistake) return 'MISTAKE';
  return 'BLUNDER';
}

function decideCategory(input: {
  action: GameAction;
  ownDelta: number;
  oppGain: number;
  raceSwing: number;
  winSwing: number;
  wallImpact: WallImpact | undefined;
  raceAdvBefore: number;
  oppDistBefore: number;
  forced: boolean;
  bestImprovesRaceByAtLeastOne: boolean;
  recentWalls: number;
  losingBefore: boolean;
  blockedImmediateWin: boolean;
}): { primary: MoveCategory; secondary?: MoveCategory } {
  const {
    action,
    ownDelta,
    oppGain,
    raceSwing,
    winSwing,
    wallImpact,
    raceAdvBefore,
    oppDistBefore,
    bestImprovesRaceByAtLeastOne,
    recentWalls,
    losingBefore,
    blockedImmediateWin,
  } = input;

  if (blockedImmediateWin) return { primary: 'DEFENSIVE', secondary: 'TACTICAL' };
  if (action.type === 'PLACE_WALL' && wallImpact) {
    if (oppGain >= ANALYSIS_CONFIG.wallTrapGain) {
      return { primary: 'TACTICAL', secondary: 'WALL_EFFICIENCY' };
    }
    if (oppGain >= 3 && ownDelta <= 0) {
      return { primary: 'WALL_EFFICIENCY', secondary: 'PATH_DENIAL' };
    }
    if (raceAdvBefore >= 2 && oppGain < 2 && oppDistBefore > 3) {
      return { primary: 'PANIC_WALL' };
    }
    if (raceAdvBefore >= 3 && oppGain < 2 && recentWalls >= 2) {
      return { primary: 'OVERBLOCK' };
    }
    if (oppGain < 1 && raceSwing <= 0) {
      return { primary: 'WALL_WASTE' };
    }
    if (oppGain >= 1) {
      return { primary: 'PATH_DENIAL', secondary: raceSwing > 0 ? 'RACE_CONTROL' : undefined };
    }
    return { primary: 'TEMPO' };
  }
  // Moves.
  if (ownDelta < 0) {
    if (losingBefore && winSwing > 0.05) return { primary: 'RECOVERY' };
    if (raceSwing > 0.5) return { primary: 'RACE_CONTROL', secondary: 'PATH_ADVANCE' };
    return { primary: 'PATH_ADVANCE' };
  }
  if (ownDelta > 0) {
    return { primary: 'ESCAPE' };
  }
  // No distance change.
  if (bestImprovesRaceByAtLeastOne) return { primary: 'WAITING_MOVE' };
  return { primary: 'TEMPO' };
}

function buildExplanation(facts: ExplanationFacts): string {
  const f = facts;
  switch (f.primaryReason) {
    case 'MISSED_WIN':
      return 'An immediate win was available and not taken.';
    case 'MISSED_DEFENSE':
      return 'The closest rival threatened to win on the next move, and this does not stop it.';
    case 'WALL_WASTE':
      return (
        `This wall costs one of the remaining walls for little effect: ` +
        `rival ${f.oppBefore} → ${f.oppAfter} steps` +
        (f.ownDistanceChange !== undefined && f.ownDistanceChange > 0
          ? `, own route ${f.ownBefore} → ${f.ownAfter} steps.`
          : '.')
      );
    case 'WALL_GOOD':
      return (
        `Good wall: the closest rival's route grew from ${f.oppBefore} to ${f.oppAfter} steps` +
        (f.ownDistanceChange !== undefined && f.ownDistanceChange > 0
          ? ` while the own route grew to ${f.ownAfter} steps.`
          : ' without lengthening the own route.')
      );
    case 'PATH_LOSS':
      return `The own route grew from ${f.ownBefore} to ${f.ownAfter} steps.`;
    case 'PATH_GAIN':
      return `The own route shortened from ${f.ownBefore} to ${f.ownAfter} steps.`;
    case 'RACE_LOSS':
    case 'RACE_GAIN':
    case 'RECOVERY': {
      const prefix = f.primaryReason === 'RECOVERY' ? 'Important recovery: ' : '';
      return `${prefix}Race went from ${f.raceBeforeText ?? 'its previous state'} to ${f.raceAfterText ?? 'its new state'}.`;
    }
    case 'LOW_MOBILITY':
      return 'This leaves very few safe replies from here.';
    case 'TACTICAL':
      return 'Serious pressure: the closest rival is squeezed with few alternatives.';
    case 'RESOURCE_WASTE':
      return 'A wall spent late for little effect, leaving fewer answers for the endgame.';
    case 'NEUTRAL':
    default:
      return 'No meaningful change either way.';
  }
}

// ---------------------------------------------------------------------------
// Single-position + single-move APIs (service interface)
// ---------------------------------------------------------------------------

export function analyzePosition(
  state: GameState,
  playerId: string,
  profileName: AnalysisProfileName = 'fast'
): PositionReport {
  const profile = ANALYSIS_PROFILES[profileName];
  const metrics = computePositionMetrics(state, playerId, 10);
  const winChance = winChanceFor(state, playerId);
  const threat = metrics.closestThreatDistance <= ANALYSIS_CONFIG.threatDist;
  const ranked = cachedRank(state, playerId, AI_PROFILES.normal, profile.fastDepth);
  const bestActions: CandidateAction[] = ranked
    .slice(0, profile.candidateCount)
    .map((r) => candidateWithEffects(state, playerId, metrics, r));
  return {
    metrics,
    winChance,
    standing: playerStanding(winChance, threat, false),
    phase: metrics.phase,
    bestActions,
    immediateThreat: threat,
  };
}

function candidateWithEffects(
  state: GameState,
  playerId: string,
  before: PositionMetrics,
  ranked: RankedAction
): CandidateAction {
  const res = applyAction(state, ranked.action);
  if (!res.success) {
    return {
      action: ranked.action,
      score: ranked.score,
      evaluation: Number.NEGATIVE_INFINITY,
      raceEffect: 0,
      wallEffect: 0,
    };
  }
  const after = computePositionMetrics(res.state, playerId, before.initialWalls);
  const evaluation = evaluateState(res.state, playerId, AI_PROFILES.normal);
  let wallEffect = 0;
  if (ranked.action.type === 'PLACE_WALL') {
    wallEffect = after.closestThreatDistance - before.closestThreatDistance;
  }
  return {
    action: ranked.action,
    score: ranked.score,
    evaluation,
    raceEffect: after.raceAdvantage - before.raceAdvantage,
    wallEffect,
  };
}

export function analyzeMove(
  beforeState: GameState,
  action: GameAction,
  profileName: AnalysisProfileName = 'normal'
): MoveAnalysis | null {
  const mover = beforeState.players[beforeState.currentPlayerIndex];
  if (!mover || beforeState.status !== 'IN_PROGRESS') return null;
  const applied = applyAction(beforeState, action);
  if (!applied.success) return null;
  const profile = ANALYSIS_PROFILES[profileName];
  const initialWalls = defaultInitialWalls(beforeState.mode);
  return analyzeSingleMove({
    beforeState,
    afterState: applied.state,
    action,
    moverId: mover.id,
    step: beforeState.history.length + 1,
    profileName,
    recentWallCount: countRecentWalls(beforeState, mover.id, 6),
    initialWalls,
    initialAvgWalls: initialWalls,
    allowDeep: profile.deepMaxDepth > profile.fastDepth,
  }).analysis;
}

/**
 * Game-start wall counts per seat, mirroring the ruleset. Used only when the
 * true initial state is unavailable (single-move API); full-game analysis
 * reads exact values from the initial state.
 */
function defaultInitialWalls(mode: GameState['mode']): number {
  switch (mode) {
    case '2p':
      return 10;
    case '4p':
      return 5;
    case 'race2':
      return 10;
    case 'race3':
      return 6;
    case 'race4':
      return 5;
    default:
      return 5;
  }
}

function countRecentWalls(state: GameState, playerId: string, lookback: number): number {
  const h = state.history;
  let n = 0;
  for (let i = Math.max(0, h.length - lookback); i < h.length; i++) {
    const r = h[i];
    if (r.playerId === playerId && r.action.type === 'PLACE_WALL') n += 1;
  }
  return n;
}

interface SingleMoveInput {
  beforeState: GameState;
  afterState: GameState;
  action: GameAction;
  moverId: string;
  step: number;
  profileName: AnalysisProfileName;
  recentWallCount: number;
  initialWalls: number;
  initialAvgWalls: number;
  allowDeep: boolean;
}

function analyzeSingleMove(input: SingleMoveInput): {
  analysis: MoveAnalysis;
  usedDeep: boolean;
} {
  const {
    beforeState,
    afterState,
    action,
    moverId,
    step,
    profileName,
    recentWallCount,
    initialWalls,
    initialAvgWalls,
    allowDeep,
  } = input;
  const profile = ANALYSIS_PROFILES[profileName];
  const aiProfile = AI_PROFILES.normal;

  const before = computePositionMetrics(beforeState, moverId, initialWalls, initialAvgWalls);
  const after = computePositionMetrics(afterState, moverId, initialWalls, initialAvgWalls);

  const evaluationBefore = evaluateState(beforeState, moverId, aiProfile);
  const evaluationAfter = evaluateState(afterState, moverId, aiProfile);

  // Fast scan (deterministic).
  const fastRanked = cachedRank(beforeState, moverId, aiProfile, profile.fastDepth);
  const fastBest = fastRanked.length > 0 ? fastRanked[0] : null;
  const fastBestScore = fastBest ? fastBest.score : Number.NEGATIVE_INFINITY;
  const actualScore = fastRanked.find((r) => actionsEqual(r.action, action))?.score;
  const fastLoss =
    fastBest && actualScore !== undefined ? Math.max(0, fastBestScore - actualScore) : 0;

  const winBefore = winChanceFor(beforeState, moverId);
  const winAfter = winChanceFor(afterState, moverId);
  const winSwing = winAfter - winBefore;

  const moverWonNow = afterState.status === 'COMPLETED' && afterState.winnerId === moverId;
  const oppCouldWinBefore = oppCanWinNext(beforeState, moverId);
  const oppCanWinAfter = oppCanWinNext(afterState, moverId);
  const moverCouldWinBefore = immediateWinningTargets(beforeState, moverId).length > 0;
  const missedWin = moverCouldWinBefore && !moverWonNow;
  const leaderBefore = leaderOf(before);
  const leaderAfter = leaderOf(after);
  const raceReversal = leaderBefore !== leaderAfter;
  const badReversal = leaderBefore === moverId && leaderAfter !== moverId;
  const raceSwing = after.raceAdvantage - before.raceAdvantage;

  const suspicious =
    fastLoss >= profile.suspiciousLoss ||
    Math.abs(winSwing) >= profile.suspiciousSwing ||
    missedWin ||
    (oppCouldWinBefore && oppCanWinAfter) ||
    raceReversal;

  // Deep dive for suspicious moves (count budget enforced by the caller).
  let ranked = fastRanked;
  let depthReached = profile.fastDepth;
  let bestAction: GameAction | null = fastBest ? fastBest.action : null;
  let bestScore = fastBestScore;
  let usedDeep = false;
  if (
    allowDeep &&
    suspicious &&
    profile.deepMaxDepth > profile.fastDepth &&
    profile.deepTimeMsPerMove > 0
  ) {
    const deep = deepRank(
      beforeState,
      moverId,
      aiProfile,
      profile.fastDepth,
      profile.deepMaxDepth,
      profile.deepTimeMsPerMove
    );
    if (deep.ranked.length > 0) {
      ranked = deep.ranked;
      depthReached = deep.depthReached;
      bestAction = deep.ranked[0].action;
      bestScore = deep.ranked[0].score;
      usedDeep = true;
    }
  }

  const actualRankedScore = ranked.find((r) => actionsEqual(r.action, action))?.score;
  const evaluationLoss = bestAction && actualRankedScore !== undefined ? Math.max(0, bestScore - actualRankedScore) : 0;

  // Best-action after-state + evaluation (legacy-compatible semantics).
  let bestActionEvaluation = evaluationBefore;
  let afterBest: GameState | null = null;
  if (bestAction) {
    const sim = applyAction(beforeState, bestAction);
    if (sim.success) {
      afterBest = sim.state;
      bestActionEvaluation = evaluateState(sim.state, moverId, aiProfile);
    }
  }

  const acceptableActions = ranked
    .filter((r) => bestScore - r.score <= ANALYSIS_CONFIG.acceptableWindow)
    .map((r) => r.action);
  const forced =
    ranked.length <= 1 ||
    acceptableActions.length >= Math.max(1, ranked.length - 1) ||
    actualRankedScore === undefined;

  const missedDefense =
    oppCouldWinBefore && oppCanWinAfter && afterBest !== null && !oppCanWinNext(afterBest, moverId);
  const blockedImmediateWin = oppCouldWinBefore && !oppCanWinAfter;

  // Wall impact for wall placements.
  let wallImpact: WallImpact | undefined;
  if (action.type === 'PLACE_WALL') {
    wallImpact = computeWallImpact(before, after);
  }

  // Move regret components (§18): how much strategic value was given away
  // versus the strongest realistic alternative.
  const bestRaceAdv = afterBest
    ? computePositionMetrics(afterBest, moverId, initialWalls).raceAdvantage
    : after.raceAdvantage;
  const raceLoss = Math.max(0, bestRaceAdv - after.raceAdvantage);
  const wallEfficiencyLoss =
    wallImpact && afterBest
      ? Math.max(
          0,
          computeWallImpact(
            before,
            computePositionMetrics(afterBest, moverId, initialWalls)
          ).efficiencyScore - wallImpact.efficiencyScore
        ) / 100
      : 0;
  const tacticalLoss =
    Math.max(0, (afterBest ? winChanceFor(afterBest, moverId) : winAfter) - winAfter) * 20;
  const regret: MoveRegret = {
    evaluationLoss,
    raceLoss,
    wallEfficiencyLoss,
    tacticalLoss,
    combined: evaluationLoss + 2 * raceLoss + tacticalLoss,
  };

  // Classification (context-aware, not raw thresholds alone).
  let assessment = baseAssessment(evaluationLoss);
  if (forced && evaluationLoss <= ANALYSIS_CONFIG.classBounds.good) {
    assessment = evaluationLoss <= ANALYSIS_CONFIG.classBounds.best ? 'BEST' : 'GOOD';
  }
  const inAcceptable = acceptableActions.some((a) => actionsEqual(a, action));
  if (inAcceptable) assessment = 'BEST';
  if (missedWin || missedDefense) assessment = worseThan(assessment, 'MISTAKE');
  if (badReversal) assessment = worseThan(assessment, 'INACCURACY');
  if (winSwing <= -ANALYSIS_CONFIG.criticalWinSwing) assessment = worseThan(assessment, 'MISTAKE');

  // Categories.
  const ownDelta = after.ownDistance - before.ownDistance;
  const oppGain = after.closestThreatDistance - before.closestThreatDistance;
  const losingBefore = winBefore < 0.35;
  const bestImprovesRaceByAtLeastOne =
    afterBest !== null &&
    computePositionMetrics(afterBest, moverId, initialWalls).raceAdvantage - before.raceAdvantage >= 1;
  const categories = decideCategory({
    action,
    ownDelta,
    oppGain,
    raceSwing,
    winSwing,
    wallImpact,
    raceAdvBefore: before.raceAdvantage,
    oppDistBefore: before.closestThreatDistance,
    forced: forced || inAcceptable,
    bestImprovesRaceByAtLeastOne,
    recentWalls: recentWallCount,
    losingBefore,
    blockedImmediateWin,
  });

  // Critical flag.
  const criticalReasons: CriticalReason[] = [];
  if (moverWonNow) criticalReasons.push('GAME_WON');
  if (missedWin) criticalReasons.push('MISSED_WIN');
  if (missedDefense) criticalReasons.push('MISSED_DEFENSE');
  if (badReversal) criticalReasons.push('RACE_REVERSAL');
  if (wallImpact && wallImpact.opponentPathGain >= ANALYSIS_CONFIG.wallTrapGain) {
    criticalReasons.push('TRAP_CREATED');
  }
  if (!moverWonNow && winAfter < 0.25 && oppCanWinAfter) criticalReasons.push('GAME_LOST');
  if (Math.abs(winSwing) >= ANALYSIS_CONFIG.criticalSwing && criticalReasons.length === 0) {
    criticalReasons.push('BIG_SWING');
  }
  const critical = criticalReasons.length > 0;

  const mobilityImpact = after.ownMobility - before.ownMobility;
  const flexibilityImpact = after.pathFlexibility - before.pathFlexibility;

  const facts = buildFacts({
    action,
    before,
    after,
    wallImpact,
    raceSwing,
    winSwing,
    missedWin,
    missedDefense,
    losingBefore,
    categories,
  });
  const explanation = buildExplanation(facts);

  const bestActions: CandidateAction[] = ranked
    .slice(0, profile.candidateCount)
    .map((r) => candidateWithEffects(beforeState, moverId, before, r));

  const needPV =
    profile.pvPlies > 0 && (critical || assessment === 'BLUNDER' || assessment === 'MISTAKE');
  const principalVariation = needPV
    ? buildPV(beforeState, moverId, aiProfile, Math.max(depthReached, 2), profile.pvPlies)
    : undefined;

  const needsTryAgain =
    assessment === 'MISTAKE' || assessment === 'BLUNDER' || criticalReasons.includes('MISSED_WIN');
  const tryAgain =
    needsTryAgain && bestAction
      ? {
          stateBefore: beforeState,
          playedAction: action,
          bestAction,
          acceptableActions: acceptableActions.slice(0, 3),
          expectedEval: bestActionEvaluation,
        }
      : undefined;

  const fromCell = moverPositionBefore(beforeState, moverId);
  const visualization: VisualizationData = {
    fromCell,
    toCell: action.type === 'MOVE' ? action.to : undefined,
    wall: action.type === 'PLACE_WALL' ? action.wall : undefined,
    bestFromCell: fromCell,
    bestToCell: bestAction && bestAction.type === 'MOVE' ? bestAction.to : undefined,
    bestWall: bestAction && bestAction.type === 'PLACE_WALL' ? bestAction.wall : undefined,
    keyCells: uniqueCells([
      ...(fromCell ? [fromCell] : []),
      ...(action.type === 'MOVE' ? [action.to] : []),
      ...(bestAction && bestAction.type === 'MOVE' ? [bestAction.to] : []),
    ]),
  };

  const moveAccuracy = forced
    ? 100
    : clampRound(100 * Math.exp(-evaluationLoss / ANALYSIS_CONFIG.accuracyScale));

  return {
    analysis: {
    step,
    playerId: moverId,
    playedAction: action,
    evaluationBefore,
    evaluationAfter,
    evaluationDelta: evaluationAfter - bestActionEvaluation,
    bestAction,
    bestActionEvaluation,
    assessment,
    explanation,
    phase: after.phase,
    before,
    after,
    evaluationLoss,
    winChanceBefore: winBefore,
    winChanceAfter: winAfter,
    winChanceSwing: winSwing,
    raceSwing,
    wallImpact,
    mobilityImpact,
    flexibilityImpact,
    bestActions,
    acceptableActions,
    forced,
    categories,
    critical,
    criticalReason: criticalReasons[0],
    criticalReasons,
    missedWin,
    missedDefense,
    raceReversal,
    badReversal,
    immediateThreat: after.closestThreatDistance <= ANALYSIS_CONFIG.threatDist,
    playerStanding: playerStanding(winAfter, oppCanWinAfter, moverWonNow),
    explanationFacts: facts,
    principalVariation,
    tryAgain,
    visualization,
    moveAccuracy,
    depthReached,
    regret,
    },
    usedDeep,
  };
}

function moverPositionBefore(state: GameState, moverId: string): CellCoord | undefined {
  return state.players.find((p) => p.id === moverId)?.position;
}

function uniqueCells(cells: CellCoord[]): CellCoord[] {
  const seen = new Set<string>();
  const out: CellCoord[] = [];
  for (const c of cells) {
    const k = `${c.row},${c.col}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'MOVE' && b.type === 'MOVE') {
    return a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL') {
    return a.wall.row === b.wall.row && a.wall.col === b.wall.col && a.wall.orientation === b.wall.orientation;
  }
  return true;
}

function leaderOf(metrics: PositionMetrics): string | null {
  // Contested ties belong to nobody (same rule as metrics.leaderId).
  let best: string | null = null;
  let bestDist = Infinity;
  let tied = false;
  for (const d of metrics.distances) {
    const fd = Number.isFinite(d.distance) ? d.distance : 999;
    if (fd < bestDist) {
      bestDist = fd;
      best = d.playerId;
      tied = false;
    } else if (fd === bestDist) {
      tied = true;
    }
  }
  return tied ? null : best;
}

function buildFacts(input: {
  action: GameAction;
  before: PositionMetrics;
  after: PositionMetrics;
  wallImpact: WallImpact | undefined;
  raceSwing: number;
  winSwing: number;
  missedWin: boolean;
  missedDefense: boolean;
  losingBefore: boolean;
  categories: { primary: MoveCategory; secondary?: MoveCategory };
}): ExplanationFacts {
  const { action, before, after, wallImpact, raceSwing, missedWin, missedDefense, losingBefore } = input;
  const ownDistanceChange = after.ownDistance - before.ownDistance;
  const opponentDistanceChange = after.closestThreatDistance - before.closestThreatDistance;
  const wallCountChange = after.ownWalls - before.ownWalls;
  const mobilityChange = after.ownMobility - before.ownMobility;
  const facts: ExplanationFacts = {
    primaryReason: 'NEUTRAL',
    ownBefore: before.ownDistance,
    ownAfter: after.ownDistance,
    oppBefore: before.closestThreatDistance,
    oppAfter: after.closestThreatDistance,
    ownDistanceChange,
    opponentDistanceChange,
    wallCountChange,
    mobilityChange,
    raceChange: raceSwing,
    raceBeforeText: describeRace(before.raceAdvantage),
    raceAfterText: describeRace(after.raceAdvantage),
    supportingFacts: [],
  };
  if (missedWin) facts.primaryReason = 'MISSED_WIN';
  else if (missedDefense) facts.primaryReason = 'MISSED_DEFENSE';
  else if (action.type === 'PLACE_WALL' && wallImpact) {
    if (wallImpact.opponentPathGain < 1 && wallImpact.ownPathCost >= 0) {
      facts.primaryReason =
        after.phase === 'ENDGAME' && wallImpact.opponentPathGain < 2
          ? 'RESOURCE_WASTE'
          : 'WALL_WASTE';
    } else if (wallImpact.opponentPathGain >= 2) {
      facts.primaryReason = 'WALL_GOOD';
    } else {
      facts.primaryReason = 'WALL_WASTE';
    }
  } else if (action.type === 'MOVE') {
    if (ownDistanceChange > 0) facts.primaryReason = 'PATH_LOSS';
    else if (raceSwing <= -1) facts.primaryReason = 'RACE_LOSS';
    else if (losingBefore && raceSwing > 0) facts.primaryReason = 'RECOVERY';
    else if (ownDistanceChange < 0) facts.primaryReason = 'PATH_GAIN';
    else if (raceSwing >= 1) facts.primaryReason = 'RACE_GAIN';
    else if (mobilityChange <= -2) facts.primaryReason = 'LOW_MOBILITY';
  }
  if (wallImpact && wallImpact.createsNewThreat && facts.primaryReason !== 'WALL_GOOD') {
    facts.primaryReason = 'TACTICAL';
  }
  const sup: string[] = [];
  if (mobilityChange !== 0) sup.push(`mobility ${before.ownMobility} → ${after.ownMobility}`);
  if (after.pathFlexibility !== before.pathFlexibility) {
    sup.push(`route options ${before.pathFlexibility} → ${after.pathFlexibility}`);
  }
  sup.push(`phase ${after.phase.toLowerCase()}`);
  facts.supportingFacts = sup;
  return facts;
}

// ---------------------------------------------------------------------------
// Full-game API
// ---------------------------------------------------------------------------

export function analyzeGame(
  initialState: GameState,
  history: RecordedAction[],
  profileName: AnalysisProfileName = 'normal'
): GameReview {
  const profile = ANALYSIS_PROFILES[profileName];
  const moveAnalyses: MoveAnalysis[] = [];
  const evaluationHistory: { step: number; evaluation: number }[] = [
    { step: 0, evaluation: evaluateState(initialState, initialState.players[0].id, AI_PROFILES.normal) },
  ];
  const winChanceHistory: GameReview['winChanceHistory'] = [
    {
      step: 0,
      winChance: winChanceFor(initialState, initialState.players[0].id),
      perPlayer: initialState.players.length > 2 ? multiWinChances(initialState) : undefined,
    },
  ];

  let currentState = initialState;
  let deepDivesUsed = 0;
  const states: GameState[] = [initialState];
  const initialWallsByPlayer: Record<string, number> = {};
  for (const p of initialState.players) initialWallsByPlayer[p.id] = p.wallsRemaining;
  const initialAvgWalls =
    initialState.players.reduce((a, p) => a + p.wallsRemaining, 0) /
    Math.max(1, initialState.players.length);

  for (let step = 1; step <= history.length; step++) {
    const recorded = history[step - 1];
    const mover = currentState.players[currentState.currentPlayerIndex];
    const applied = applyAction(currentState, recorded.action, {
      timestamp: recorded.timestamp,
      clockRemainingMs: recorded.clockRemainingMs,
    });
    if (!applied.success) break;
    const afterState = applied.state;

    const allowDeep = deepDivesUsed < profile.maxDeepDives;
    const { analysis, usedDeep } = analyzeSingleMove({
      beforeState: currentState,
      afterState,
      action: recorded.action,
      moverId: mover.id,
      step,
      profileName,
      recentWallCount: countRecentWalls(currentState, mover.id, 6),
      initialWalls: initialWallsByPlayer[mover.id] ?? 10,
      initialAvgWalls: initialAvgWalls,
      allowDeep,
    });
    if (usedDeep) deepDivesUsed += 1;
    moveAnalyses.push(analysis);

    const p1Eval = evaluateState(afterState, initialState.players[0].id, AI_PROFILES.normal);
    evaluationHistory.push({ step, evaluation: p1Eval });
    winChanceHistory.push({
      step,
      winChance: winChanceFor(afterState, initialState.players[0].id),
      perPlayer: afterState.players.length > 2 ? multiWinChances(afterState) : undefined,
    });

    currentState = afterState;
    states.push(afterState);
  }

  // Deciding moments: importance = swing + reversal + critical + endgame weight.
  // States come from the canonical replay chain (step N lives between
  // states[N-1] and states[N]).
  const moments: DecidingMoment[] = moveAnalyses.map((m) => ({
    moveNumber: m.step,
    playerId: m.playerId,
    reason: (m.criticalReason ?? 'SWING') as DecidingMoment['reason'],
    beforeWinChance: m.winChanceBefore,
    afterWinChance: m.winChanceAfter,
    evaluationSwing: m.evaluationAfter - m.evaluationBefore,
    raceSwing: m.raceSwing,
    importance:
      Math.abs(m.winChanceSwing) * 100 +
      (m.badReversal ? 25 : 0) +
      (m.critical ? 15 : 0) +
      (m.phase === 'ENDGAME' ? 5 : 0),
    beforeState: states[m.step - 1] ?? currentState,
    afterState: states[m.step] ?? currentState,
  }));
  moments.sort((a, b) => b.importance - a.importance);
  const decidingMoments = moments.slice(0, 3);

  const summary = buildSummary(moveAnalyses, decidingMoments[0]);

  return {
    totalMoves: history.length,
    winnerId: currentState.winnerId,
    moveAnalyses,
    evaluationHistory,
    engineVersion: ANALYSIS_ENGINE_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    rulesetVersion: initialState.rulesetVersion,
    profile: profileName,
    winChanceHistory,
    decidingMoments,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Game summary, trends, coach data (all derived from real analyzed games)
// ---------------------------------------------------------------------------

function assessmentCounter() {
  return {
    bestMoves: 0,
    excellentMoves: 0,
    goodMoves: 0,
    inaccuracies: 0,
    mistakes: 0,
    blunders: 0,
  };
}

/** Clamp to 0..100 and round to 1 decimal (never show 100.0000001%). */
function clampRound(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
}

function buildSummary(
  moveAnalyses: MoveAnalysis[],
  decidingMoment?: DecidingMoment
): GameSummary {
  const counts = assessmentCounter();
  const perPlayer = new Map<string, { acc: number; weight: number; moves: number }>();
  const catCount = new Map<string, { moves: number[]; bad: boolean }>();
  let wallEffSum = 0;
  let wallEffN = 0;
  let wallWasteCount = 0;
  let panicWallCount = 0;
  let decisive = 0;

  const BAD_CATS = new Set(['WALL_WASTE', 'PANIC_WALL', 'OVERBLOCK']);
  const GOOD_CATS = new Set(['WALL_EFFICIENCY', 'RECOVERY', 'DEFENSIVE', 'WINNING_CONVERSION', 'RACE_CONTROL']);

  for (const m of moveAnalyses) {
    if (m.assessment === 'BEST') counts.bestMoves += 1;
    else if (m.assessment === 'EXCELLENT') counts.excellentMoves += 1;
    else if (m.assessment === 'GOOD') counts.goodMoves += 1;
    else if (m.assessment === 'INACCURACY') counts.inaccuracies += 1;
    else if (m.assessment === 'MISTAKE') counts.mistakes += 1;
    else counts.blunders += 1;

    const w = 1 + 6 * Math.abs(m.winChanceSwing) + (m.critical ? 4 : 0);
    const slot = perPlayer.get(m.playerId) ?? { acc: 0, weight: 0, moves: 0 };
    slot.acc += m.moveAccuracy * w;
    slot.weight += w;
    slot.moves += 1;
    perPlayer.set(m.playerId, slot);

    if (Math.abs(m.winChanceSwing) > 0.03 || m.critical) decisive += 1;

    const cat = m.categories.primary;
    const entry = catCount.get(cat) ?? { moves: [], bad: BAD_CATS.has(cat) };
    if (entry.moves.length < 5) entry.moves.push(m.step);
    entry.moves = entry.moves.slice(0, 5);
    catCount.set(cat, entry);

    if (m.wallImpact) {
      wallEffSum += m.wallImpact.efficiencyScore;
      wallEffN += 1;
    }
    if (cat === 'WALL_WASTE') wallWasteCount += 1;
    if (cat === 'PANIC_WALL') panicWallCount += 1;
  }

  const accuracy: GameSummary['accuracy'] = {};
  for (const [pid, s] of perPlayer) {
    accuracy[pid] = {
      accuracy: s.weight > 0 ? clampRound(s.acc / s.weight) : 0,
      moves: s.moves,
    };
  }
  const [lowDecisive, highDecisive] = ANALYSIS_CONFIG.confidenceDecisive;
  const confidence: GameSummary['confidence'] =
    decisive < lowDecisive ? 'low' : decisive < highDecisive ? 'medium' : 'high';

  const goodHits: Insight[] = [];
  const badHits: Insight[] = [];
  for (const [cat, entry] of catCount) {
    const insight: Insight = {
      title: catTitle(cat),
      detail: catDetail(cat, entry.moves.length),
      moveNumbers: entry.moves,
    };
    if (entry.bad) badHits.push(insight);
    else if (GOOD_CATS.has(cat)) goodHits.push(insight);
  }
  const byMoves = (a: Insight, b: Insight) => b.moveNumbers.length - a.moveNumbers.length;
  goodHits.sort(byMoves);
  badHits.sort(byMoves);

  const finalRaceAdvantage =
    moveAnalyses.length > 0 ? moveAnalyses[moveAnalyses.length - 1].after.raceAdvantage : 0;

  const keyLesson: Insight =
    badHits.length > 0
      ? {
          title: badHits[0].title,
          detail: lessonFor(badHits[0].title),
          moveNumbers: badHits[0].moveNumbers,
        }
      : goodHits.length > 0
      ? {
          title: goodHits[0].title,
          detail: 'Keep doing this: it consistently improved the position.',
          moveNumbers: goodHits[0].moveNumbers,
        }
      : { title: 'Solid game', detail: 'No repeated costly patterns found.', moveNumbers: [] };

  return {
    accuracy,
    confidence,
    totalMoves: moveAnalyses.length,
    ...counts,
    decidingMoment,
    biggestStrengths: goodHits.slice(0, 2),
    biggestWeaknesses: badHits.slice(0, 2),
    finalRaceAdvantage,
    avgWallEfficiency: wallEffN > 0 ? wallEffSum / wallEffN : 50,
    wallWasteCount,
    panicWallCount,
    keyLesson,
  };
}

function catTitle(cat: string): string {
  switch (cat) {
    case 'WALL_EFFICIENCY':
      return 'Efficient walls';
    case 'WALL_WASTE':
      return 'Wasted walls';
    case 'PANIC_WALL':
      return 'Panic walls';
    case 'OVERBLOCK':
      return 'Overblocking';
    case 'RECOVERY':
      return 'Recoveries';
    case 'DEFENSIVE':
      return 'Key defenses';
    case 'WINNING_CONVERSION':
      return 'Clinical finishes';
    case 'RACE_CONTROL':
      return 'Race control';
    case 'PATH_ADVANCE':
      return 'Steady advances';
    case 'PATH_DENIAL':
      return 'Route denial';
    default:
      return cat.charAt(0) + cat.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}

function catDetail(cat: string, n: number): string {
  const times = n === 1 ? 'once' : `${n} times`;
  switch (cat) {
    case 'WALL_EFFICIENCY':
      return `Walls that stretched the rival's route without costing yours, ${times}.`;
    case 'WALL_WASTE':
      return `Walls spent without slowing the rival, ${times}.`;
    case 'PANIC_WALL':
      return `Walls thrown while already ahead that changed almost nothing, ${times}.`;
    case 'OVERBLOCK':
      return `Too many walls committed against a non-threatening route, ${times}.`;
    case 'RECOVERY':
      return `Fought back from a worse position, ${times}.`;
    case 'DEFENSIVE':
      return `Stopped an immediate loss, ${times}.`;
    default:
      return `Happened ${times}.`;
  }
}

function lessonFor(title: string): string {
  switch (title) {
    case 'Wasted walls':
      return 'Spend walls only when they lengthen the rival route — a wall that changes nothing is a wasted turn.';
    case 'Panic walls':
      return 'When ahead, keep marching: walls that do not slow a non-threatening rival give the race away.';
    case 'Overblocking':
      return 'One good wall beats three hopeful ones — stop spending once the route is already shaped.';
    default:
      return 'Review the flagged moves above and look for the cheaper alternative.';
  }
}

/**
 * Trend aggregation over past game summaries. A "leak" needs at least
 * trendMinGames games and an issue rate above leakRateThreshold —
 * never conclusions from 1–2 games.
 */
export function summarizeTrend(summaries: GameSummary[]): TrendReport {
  const games = summaries.length;
  const accuracyTrend: number[] = [];
  const wallEfficiencyTrend: number[] = [];
  const mistakeFrequency: number[] = [];
  const blunderFrequency: number[] = [];
  let wasteWalls = 0;
  let panicWalls = 0;
  let totalWalls = 0;

  for (const s of summaries) {
    const accs = Object.values(s.accuracy);
    accuracyTrend.push(
      accs.length > 0 ? accs.reduce((a, b) => a + b.accuracy, 0) / accs.length : 0
    );
    wallEfficiencyTrend.push(s.avgWallEfficiency);
    const moves = Math.max(1, s.totalMoves);
    mistakeFrequency.push(s.mistakes / moves);
    blunderFrequency.push(s.blunders / moves);
    wasteWalls += s.wallWasteCount;
    panicWalls += s.panicWallCount;
    totalWalls += s.wallWasteCount + s.panicWallCount;
  }

  let leak: string | undefined;
  if (games >= ANALYSIS_CONFIG.trendMinGames && totalWalls > 0) {
    const wasteRate = wasteWalls / totalWalls;
    const panicRate = panicWalls / totalWalls;
    if (wasteRate > ANALYSIS_CONFIG.leakRateThreshold) {
      leak = `You waste ${Math.round(wasteRate * 100)}% of flagged walls without slowing the rival — spend only on walls that add steps.`;
    } else if (panicRate > ANALYSIS_CONFIG.leakRateThreshold) {
      leak = `You throw panic walls while ahead in ${Math.round(panicRate * 100)}% of flagged cases — march instead.`;
    }
  }

  return { games, accuracyTrend, wallEfficiencyTrend, mistakeFrequency, blunderFrequency, leak };
}
