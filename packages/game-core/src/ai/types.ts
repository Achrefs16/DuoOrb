import type { CellCoord, GameAction, GameState, WallCoord } from '../types.js';

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
  engine?: 'search' | 'mcts';
  simulations?: number;
  uctConst?: number;
  wallMoveProb?: number;
  blockMoveProb?: number;
  maxRolloutPlies?: number;
  wallHorizon?: number;
}

export interface AiWallTuning {
  /**
   * Only walls that delay nobody cost a turn of tempo.
   * A wall that pushes the rival back has already bought the tempo it cost.
   */
  denialIsTempo: boolean;
  /** Weight on positional fragility (0 = off). */
  fragilityWeight: number;
}

export interface AiProductionBudget {
  /** Whole-turn wall-clock ceiling. A safety net, not the target. */
  timeMs: number;
  /** Hard depth cap for this mode and difficulty. */
  maxDepth: number;
}

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
  planSuppression: number;
}

export interface ScoredCandidate {
  action: GameAction;
  onPath: boolean;
  wall: WallInsight | null;
  rank: number;
  order: number;
  planSlot?: boolean;
  /** This wall is a brick of my own attack blueprint (offensive funnel). */
  attackSlot?: boolean;
  /** This wall breaks the rival's forecasted seal against me. */
  sealbreak?: boolean;
}

export interface RankedAction {
  action: GameAction;
  score: number;
  progress: boolean;
  winsNow: boolean;
  exchange?: { myDistance: number; theirDistance: number } | null;
  candidateOrder?: number;
}

export interface RankOptions {
  depth?: number;
  deterministic?: boolean;
  tactical?: AiTactical;
  strategic?: import('../ai-threat.js').StrategicRead | null;
  attack?: import('../ai-threat.js').AttackBlueprint | null;
  candidates?: ScoredCandidate[];
  timeBudgetMs?: number;
  rng?: () => number;
  tuning?: Partial<AiWallTuning>;
  ctx?: SearchContext;
}

export interface SearchContext {
  profile: AIProfile;
  rootId: string;
  deadline: number;
  aborted: boolean;
  nodes: number;
  tt: Map<bigint, { depth: number; value: number; bound: 0 | 1 | 2; move?: GameAction | null }>;
  multiplayer: boolean;
  rootDepth: number;
  killers: (GameAction | null)[][];
  sliceStart: number;
  sliceDeadline: number;
  suspended: boolean;
  sealSlots: number[] | null;
  deadlineInterval: number;
}

export interface AiSearchStats {
  depthReached: number;
  depthRequested: number;
  truncated: boolean;
  nodes: number;
  elapsedMs: number;
}

export interface AsyncSearchHooks {
  onDepth?: (stats: AiSearchStats) => void;
  shouldCancel?: () => boolean;
  maxDepth?: number;
  budget?: AiProductionBudget;
}
