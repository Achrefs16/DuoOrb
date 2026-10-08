import type { AIDifficulty, AIProfile, AiWallTuning } from './types.js';

export const AI_BUILD = 20;

export const AI_PROFILES: Record<AIDifficulty, AIProfile> = {
  easy: {
    difficulty: 'easy',
    depth: 1,
    randomness: 0.35,
    weights: { pathDifference: 8.0, wallAdvantage: 0.5, mobility: 0.2, pathways: 0.35, tightness: 0.4, placement: 1.0 },
    maxCandidateWalls: 3,
    timeBudgetMs: 50,
    simulations: 300,
    engine: 'mcts',
    wallMoveProb: 0.2,
    blockMoveProb: 0.25,
    uctConst: 0.5,
    wallHorizon: 4,
  },
  normal: {
    difficulty: 'normal',
    depth: 2,
    randomness: 0.05,
    weights: { pathDifference: 10.0, wallAdvantage: 1.0, mobility: 0.5, pathways: 0.6, tightness: 0.8, placement: 1.5 },
    maxCandidateWalls: 5,
    timeBudgetMs: 150,
    simulations: 1000,
    engine: 'mcts',
    wallMoveProb: 0.3,
    blockMoveProb: 0.4,
    uctConst: 0.4,
    wallHorizon: 6,
  },
  hard: {
    difficulty: 'hard',
    depth: 3,
    randomness: 0.0,
    weights: { pathDifference: 12.0, wallAdvantage: 1.5, mobility: 0.8, pathways: 0.9, tightness: 1.2, placement: 2.0 },
    maxCandidateWalls: 8,
    timeBudgetMs: 350,
    simulations: 2500,
    engine: 'mcts',
    wallMoveProb: 0.35,
    blockMoveProb: 0.5,
    uctConst: 0.35,
    wallHorizon: 9,
  },
};

export const DEFAULT_WALL_TUNING: AiWallTuning = {
  denialIsTempo: true,
  fragilityWeight: 0,
};

export const WIN_SCORE = 10000;
export const PLACEMENT_STEP = 1000;
export const TIE_EPSILON = 1e-6;
export const MOVER_WIN_BAR = WIN_SCORE - 1;

export const STRUCTURE_CAP_SHARE = 0.75;
export const ROOT_STRUCTURE_CAP_SHARE = 0.5;

export const RIVAL_PRESSURE_WINDOW = 4;
export const RIVAL_PRESSURE_STEPS = 1;

export const ON_PATH_BONUS = 4;
export const RACING_BONUS = 3;

export const RAW_SLOT_CAP = 96;
export const PROBE_PER_WALL = 6;
export const ROUTE_BAND_CELLS = 6;
export const APPROACH_CELLS = 3;
export const CHAIN_EXTENSION_CELLS = 6;
export const CONTEST_DISTANCE = 2;
export const SLOT_PREVENT_CAP = 6;

export const SELF_CRITICAL_TIGHTEST = 3;
export const PLAN_PROMOTION = 0.5;
export const PLAN_DEFENCE_BAR = 1.4;
export const SELF_GAIN_BAR = 0.9;
export const FRAGILITY_BAR = 0.8;
export const PREVENT_BAR = 2;
export const SPEND_TIEBREAK = 0.25;
export const SPARE_WALLS = 3;
export const STRATEGIC_EXTRA_DEPTH = 1;

export const INNER_PLAN_WALLS = 2;
export const DEEP_WALL_SHARE = 0.5;
export const REPETITION_SCALE = 1.0;
export const FRAGILE_LANDING = 0.8;
export const FRAGILE_RIVAL_RANGE = 2;

/**
 * Offensive funnel credit: a brick of my own attack blueprint earns a share
 * of the blueprint's combined damage, capped so one promising funnel cannot
 * outshout a forced march. Derived bounds: the share must beat the tempo tax
 * (1 step) plus the on-path bonus it competes with, hence 0.5 of damage with
 * a 1.5-step cap — enough to play a +3 funnel's first brick, never enough to
 * wall blindly.
 */
export const ATTACK_SHARE = 0.5;
export const ATTACK_CREDIT_CAP = 3.0;
