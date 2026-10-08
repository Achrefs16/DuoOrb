/**
 * DuoOrb Intelligent Analysis — Core Data Types & Configuration
 *
 * NOTE: The server-side native Rust MCTS engine (@duoorb/analyzer-rust)
 * is now the authoritative single source of truth for all match analyses.
 * This file maintains canonical TypeScript type contracts and calibration constants.
 */

import {
  CellCoord,
  GameAction,
  GameState,
  RecordedAction,
  WallCoord,
} from './types.js';

// ---------------------------------------------------------------------------
// Versions & Config
// ---------------------------------------------------------------------------

export const ANALYSIS_ENGINE_VERSION = 'duoorb-rust-mcts-2.0';
export const ANALYSIS_VERSION = 'analysis-2.0';

export const ANALYSIS_CONFIG = {
  winChanceScale: 20,
  classBounds: { best: 1.0, excellent: 3.0, good: 6.0, inaccuracy: 14.0, mistake: 25.0 },
  acceptableWindow: 1.0,
  criticalWinSwing: 0.2,
  criticalSwing: 0.15,
  accuracyScale: 12,
  confidenceDecisive: [4, 10] as const,
  trendMinGames: 10,
  leakRateThreshold: 0.25,
  flexibilitySlack: 2,
  wallTrapGain: 4,
  threatGain: 3,
  threatDist: 1,
  optionsLossRatio: 0.25,
  endgameDist: 2,
  endgameWalls: 1,
  openingWallRatio: 0.7,
  openingDist: 5,
  cacheSize: 1000,
} as const;

export type AnalysisProfileName = 'fast' | 'normal' | 'deep';

export interface AnalysisProfile {
  fastDepth: number;
  deepMaxDepth: number;
  deepTimeMsPerMove: number;
  maxDeepDives: number;
  candidateCount: number;
  advancedMetrics: boolean;
  pvPlies: number;
  suspiciousLoss: number;
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
// Assessment & Classification Types
// ---------------------------------------------------------------------------

export type MoveAssessment =
  | 'BEST'
  | 'EXCELLENT'
  | 'GOOD'
  | 'INACCURACY'
  | 'MISTAKE'
  | 'BLUNDER'
  | 'FORCED';

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
  distances: PlayerDistance[];
  closestThreatId: string | null;
  closestThreatDistance: number;
  raceAdvantage: number;
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
  efficiencyScore: number;
  wallResourceValue: number;
}

export interface CandidateAction {
  action: GameAction;
  score: number;
  evaluation: number;
  raceEffect: number;
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
  step: number;
  playerId: string;
  playedAction: GameAction;
  evaluationBefore?: number;
  evaluationAfter: number;
  evaluationDelta?: number;
  bestAction: GameAction | null;
  bestActionEvaluation?: number;
  assessment: MoveAssessment;
  explanation?: string;
  phase?: GamePhase;
  before?: PositionMetrics;
  after?: PositionMetrics;
  evaluationLoss: number;
  regret?: MoveRegret;
  winChanceBefore?: number;
  winChanceAfter?: number;
  winChanceSwing?: number;
  raceSwing?: number;
  wallImpact?: WallImpact;
  mobilityImpact?: number;
  flexibilityImpact?: number;
  bestActions?: CandidateAction[];
  acceptableActions?: GameAction[];
  forced: boolean;
  categories?: { primary: MoveCategory; secondary?: MoveCategory };
  critical?: boolean;
  criticalReason?: CriticalReason;
  criticalReasons?: CriticalReason[];
  missedWin?: boolean;
  missedDefense?: boolean;
  raceReversal?: boolean;
  badReversal?: boolean;
  immediateThreat?: boolean;
  playerStanding?: PlayerStanding;
  explanationFacts?: ExplanationFacts;
  principalVariation?: GameAction[];
  tryAgain?: TryAgainData;
  visualization?: VisualizationData;
  moveAccuracy?: number;
  depthReached?: number;
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
  beforeState?: GameState;
  afterState?: GameState;
}

export interface Insight {
  title: string;
  detail: string;
  moveNumbers?: number[];
  moveNumber?: number;
}

export interface GameSummary {
  accuracy: Record<string, { accuracy: number; moves: number }>;
  confidence: 'low' | 'medium' | 'high';
  totalMoves?: number;
  bestMoves?: number;
  excellentMoves?: number;
  goodMoves?: number;
  inaccuracies?: number;
  mistakes?: number;
  blunders?: number;
  decidingMoment?: DecidingMoment;
  biggestStrengths?: Insight[];
  biggestWeaknesses?: Insight[];
  finalRaceAdvantage?: number;
  avgWallEfficiency?: number;
  wallWasteCount?: number;
  panicWallCount?: number;
  keyLesson: Insight;
}

export interface GameReview {
  totalMoves: number;
  winnerId?: string | null;
  moveAnalyses: MoveAnalysis[];
  evaluationHistory?: { step: number; evaluation: number }[];
  engineVersion: string;
  analysisVersion: string;
  rulesetVersion?: string;
  profile?: AnalysisProfileName;
  winChanceHistory?: { step: number; winChance: number; perPlayer?: Record<string, number> }[];
  decidingMoments?: DecidingMoment[];
  summary: GameSummary;
  accuracies?: Record<string, number>;
  criticalMoments?: number[];
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
