import type { CellCoord, GameAction, GameState, WallCoord } from './types.js';
import type { BotOpeningStyle, BotWallStyle } from './ai/types.js';
import { getLegalMoves } from './movement.js';
import { getShortestDistance, getShortestPath, isGoalCell } from './pathfinding.js';
import { isLegalWallPlacement } from './walls.js';
import { doesWallConflict, isWallWithinBoard } from './geometry.js';
import { applyAction } from './ruleset.js';
import { boardOf } from './ai-structure.js';
import { jumpTrapPenalty, repetitionPenalty } from './ai/evaluation.js';

/**
 * Pure heuristic MCTS (no neural network): PUCT selection, heuristic
 * expansion, biased rollouts, max-n backup. One code path serves every
 * mode and player count — multiplayer needs no special casing because
 * each node optimises only its own mover's outcome component.
 *
 * Intended as a sparring partner and measurement tool, not a replacement:
 * strength comes from simulation count, which is the caller's explicit
 * budget (there is no clock inside).
 */

export interface MctsOptions {
  /** Full simulations per move. Strength scales with this. */
  simulations?: number;
  /** PUCT exploration constant (win-rate units). */
  uctConst?: number;
  /** Seed for full determinism; omit for nondeterministic play. */
  seed?: number;
  /** Rollout wall probability (rest: shortest-path step or backward move). */
  wallMoveProb?: number;
  /** Rollout length cap; hit means draw. */
  maxRolloutPlies?: number;
  /** Rollout probability of a targeted block on an opponent's next step. */
  blockMoveProb?: number;
  /** Wall-clock time budget in ms; if reached after minimal exploration, halts gracefully. */
  timeBudgetMs?: number;
  /** Lookahead steps along opponent shortest path for generating blocking walls. Defaults to 6. */
  wallHorizon?: number;
  /** Chance per turn to deliberately make a human-like suboptimal choice. */
  blunderRate?: number;
  /** Chance to ignore a one-step loss threat (Beginner personalities). */
  missDefenseProb?: number;
  /** Chance to keep a decorative wall with no positive race gain. */
  naiveWallProb?: number;
  /** Root softmax sampling temperature (lower = sharper). */
  softmaxTemp?: number;
  /** Allowed Q drop when sampling equally strong root moves. */
  varietyWindow?: number;
  wallStyle?: BotWallStyle;
  openingStyle?: BotOpeningStyle;
}

export interface MctsStats {
  simulations: number;
  nodes: number;
  elapsedMs: number;
  bestVisits: number;
  bestWinRate: number;
}

interface MctsNode {
  move: GameAction | null;
  parent: MctsNode | null;
  children: MctsNode[];
  state: GameState;
  moverIndex: number;
  visits: number;
  rewards: number[];
  terminalWinner: number | null; // player index, -1 = draw, null = open
  /** Heuristic prior for PUCT at the parent that created this node. */
  prior: number;
}

interface WallBlock {
  wall: WallCoord;
  delay: number;
  selfCost: number;
  netGain: number;
}

interface WallCandidate {
  wall: WallCoord;
  /** True when findPathBlockingWalls proved positive net race tempo. */
  positive: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function winnerIndexOf(state: GameState): number | null {
  if (state.winnerId) {
    const idx = state.players.findIndex((p) => p.id === state.winnerId);
    if (idx >= 0) return idx;
  }
  const first = state.players.findIndex((p) => p.place === 1);
  if (first >= 0) return first;
  if (state.status === 'COMPLETED') return -1;
  return null;
}

function distanceOf(
  position: CellCoord,
  goalDirection: GameState['players'][number]['goalDirection'],
  state: GameState
): number {
  return getShortestDistance(position, goalDirection, state.walls, state.mode);
}

/** Shortest-path next step: path[0] is the current cell by contract. */
function nextPathStep(state: GameState, player: GameState['players'][number]): CellCoord | null {
  const path = getShortestPath(player.position, player.goalDirection, state.walls, state.mode);
  return path && path.length > 1 ? path[1] : null;
}

/** Cheap "is this pawn one move from its goal" check; no BFS. */
function isOneStepFromGoal(
  position: CellCoord,
  goalDirection: GameState['players'][number]['goalDirection'],
  mode: GameState['mode']
): boolean {
  if (mode.startsWith('center')) {
    return Math.abs(position.row - 4) + Math.abs(position.col - 4) === 1;
  }
  if (goalDirection === 'BOTTOM') return position.row === 7;
  if (goalDirection === 'TOP') return position.row === 1;
  if (goalDirection === 'RIGHT') return position.col === 7;
  return position.col === 1;
}

/** Unit progress of an adjacent legal move, without pathfinding. */
function moveProgress(
  from: CellCoord,
  to: CellCoord,
  goalDirection: GameState['players'][number]['goalDirection'],
  mode: GameState['mode']
): number {
  if (mode.startsWith('center')) {
    const before = Math.abs(from.row - 4) + Math.abs(from.col - 4);
    const after = Math.abs(to.row - 4) + Math.abs(to.col - 4);
    return before - after;
  }
  if (goalDirection === 'BOTTOM') return to.row - from.row;
  if (goalDirection === 'TOP') return from.row - to.row;
  if (goalDirection === 'RIGHT') return to.col - from.col;
  return from.col - to.col;
}

/**
 * Tight wall candidate set: the four slots bordering my own pawn, plus the
 * path-crossing slots that most lengthen each active opponent's route.
 *
 * Every candidate is scored by NET race tempo, not raw opponent delay: a wall
 * that also lengthens our own route is rejected. This is the selfCost pruning
 * that stops bots throwing decorative walls at the board.
 */
function findPathBlockingWalls(
  st: GameState,
  actorId: string,
  target: GameState['players'][number],
  horizon = 6
): WallBlock[] {
  const base = distanceOf(target.position, target.goalDirection, st);
  if (!Number.isFinite(base) || base <= 0) return [];
  const path = getShortestPath(target.position, target.goalDirection, st.walls, st.mode);
  const candidates: WallCoord[] = [];
  const seen = new Set<string>();
  const add = (w: WallCoord) => {
    if (w.row < 0 || w.row > 7 || w.col < 0 || w.col > 7) return;
    const k = `${w.row},${w.col},${w.orientation}`;
    if (!seen.has(k)) {
      seen.add(k);
      candidates.push(w);
    }
  };

  // 1. Touch slots
  const { row, col } = target.position;
  add({ row: row - 1, col, orientation: 'H' });
  add({ row, col, orientation: 'H' });
  add({ row, col: col - 1, orientation: 'V' });
  add({ row, col, orientation: 'V' });

  // 2. Path crossing slots (first N steps of opponent shortest path)
  if (path && path.length > 0) {
    let cur = target.position;
    const steps = Math.min(path.length, Math.max(2, horizon));
    for (let i = 0; i < steps; i++) {
      const next = path[i];
      if (next.row === cur.row + 1) {
        add({ row: cur.row, col: cur.col, orientation: 'H' });
        add({ row: cur.row, col: cur.col - 1, orientation: 'H' });
      } else if (next.row === cur.row - 1) {
        add({ row: next.row, col: cur.col, orientation: 'H' });
        add({ row: next.row, col: cur.col - 1, orientation: 'H' });
      } else if (next.col === cur.col + 1) {
        add({ row: cur.row, col: cur.col, orientation: 'V' });
        add({ row: cur.row - 1, col: cur.col, orientation: 'V' });
      } else if (next.col === cur.col - 1) {
        add({ row: cur.row, col: next.col, orientation: 'V' });
        add({ row: cur.row - 1, col: next.col, orientation: 'V' });
      }
      cur = next;
    }
  }

  const actor = st.players.find((p) => p.id === actorId);
  if (!actor) return [];
  const myBase = distanceOf(actor.position, actor.goalDirection, st);
  const scored: { slot: WallCoord; delay: number; after: number }[] = [];
  for (const slot of candidates) {
    // Geometry is cheap. Full path preservation for every active player is
    // expensive, so defer it until after the delay ranking has reduced the
    // candidate set to a handful.
    if (!isWallWithinBoard(slot) || doesWallConflict(slot, st.walls)) continue;
    const afterWalls = [...st.walls, slot];
    const after = getShortestDistance(target.position, target.goalDirection, afterWalls, st.mode);
    if (!Number.isFinite(after)) continue;
    const delay = after - base;
    if (delay > 0) scored.push({ slot, delay, after });
  }
  // Delay is one BFS per candidate. Self-cost is only measured for the most
  // promising few: measuring every candidate made expansion several times
  // slower than the search it feeds.
  scored.sort((a, b) => b.delay - a.delay);
  const results: WallBlock[] = [];
  for (let i = 0; i < Math.min(6, scored.length); i++) {
    const { slot, delay, after } = scored[i];
    if (!isLegalWallPlacement(st, actorId, slot)) continue;
    const afterWalls = [...st.walls, slot];
    const myAfter = getShortestDistance(actor.position, actor.goalDirection, afterWalls, st.mode);
    const selfCost = Math.max(0, (Number.isFinite(myAfter) ? myAfter : myBase + 99) - myBase);
    const netGain = delay - selfCost;
    if (netGain >= 0 || (base === 1 && after > 1)) {
      results.push({ wall: slot, delay, selfCost, netGain });
    }
  }
  results.sort((a, b) => b.netGain - a.netGain || b.delay - a.delay);
  return results;
}

function findBlockingWall(
  st: GameState,
  actorId: string,
  target: GameState['players'][number],
  horizon = 6
): WallCoord | null {
  const blocks = findPathBlockingWalls(st, actorId, target, horizon);
  return blocks.length > 0 ? blocks[0].wall : null;
}

/** Defensive walls 1-2 rows behind our own pawn, for back-gate styles. */
function backGateWalls(st: GameState, me: GameState['players'][number]): WallCoord[] {
  const out: WallCoord[] = [];
  const add = (w: WallCoord) => {
    if (w.row < 0 || w.row > 7 || w.col < 0 || w.col > 7) return;
    out.push(w);
  };
  if (me.goalDirection === 'BOTTOM') {
    for (const r of [me.position.row - 2, me.position.row - 1]) {
      add({ row: r, col: me.position.col - 1, orientation: 'H' });
      add({ row: r, col: me.position.col, orientation: 'H' });
    }
  } else if (me.goalDirection === 'TOP') {
    for (const r of [me.position.row + 1, me.position.row + 2]) {
      add({ row: r, col: me.position.col - 1, orientation: 'H' });
      add({ row: r, col: me.position.col, orientation: 'H' });
    }
  } else if (me.goalDirection === 'RIGHT') {
    for (const c of [me.position.col - 2, me.position.col - 1]) {
      add({ row: me.position.row - 1, col: c, orientation: 'V' });
      add({ row: me.position.row, col: c, orientation: 'V' });
    }
  } else if (me.goalDirection === 'LEFT') {
    for (const c of [me.position.col + 1, me.position.col + 2]) {
      add({ row: me.position.row - 1, col: c, orientation: 'V' });
      add({ row: me.position.row, col: c, orientation: 'V' });
    }
  }
  return out;
}

function styleOrder(
  walls: WallCandidate[],
  style: BotWallStyle,
  me: GameState['players'][number]
): WallCandidate[] {
  if (style === 'balanced' || style === 'minimal') return walls;
  const score = (c: WallCandidate): number => {
    const w = c.wall;
    if (style === 'horizontal_barricade') return w.orientation === 'H' ? 2 : 0;
    if (style === 'vertical_corridor') return w.orientation === 'V' ? 2 : 0;
    if (style === 'flank_trap') return w.col <= 2 || w.col >= 5 ? 2 : 0;
    if (style === 'defensive_backwall') {
      const behind =
        me.goalDirection === 'BOTTOM'
          ? w.row < me.position.row
          : me.goalDirection === 'TOP'
            ? w.row > me.position.row
            : me.goalDirection === 'RIGHT'
              ? w.col < me.position.col
              : w.col > me.position.col;
      return behind && w.orientation === 'H' ? 2 : 0;
    }
    return 0;
  };
  return [...walls].sort((a, b) => score(b) - score(a));
}

function probableWalls(
  st: GameState,
  playerId: string,
  horizon = 6,
  wallStyle: BotWallStyle = 'balanced',
  openingStyle: BotOpeningStyle = 'center_march'
): WallCandidate[] {
  const out = new Map<string, WallCandidate>();
  const add = (slot: WallCoord, positive: boolean): void => {
    if (slot.row < 0 || slot.row > 7 || slot.col < 0 || slot.col > 7) return;
    const key = `${slot.row},${slot.col},${slot.orientation}`;
    const existing = out.get(key);
    if (existing) {
      existing.positive = existing.positive || positive;
      return;
    }
    out.set(key, { wall: slot, positive });
  };

  const me = st.players.find((p) => p.id === playerId);
  const criticalFoe = st.players.find(
    (p) =>
      p.id !== playerId &&
      p.status === 'ACTIVE' &&
      isOneStepFromGoal(p.position, p.goalDirection, st.mode)
  );
  if (criticalFoe) {
    const blocks = findPathBlockingWalls(st, playerId, criticalFoe, horizon);
    for (const b of blocks) add(b.wall, true);
    return [...out.values()];
  }

  if (me) {
    if (openingStyle === 'back_gate' || wallStyle === 'defensive_backwall') {
      for (const w of backGateWalls(st, me)) add(w, false);
    }
    if (wallStyle !== 'minimal') {
      const { row, col } = me.position;
      for (const slot of [
        { row: row - 1, col, orientation: 'H' as const },
        { row, col, orientation: 'H' as const },
        { row, col: col - 1, orientation: 'V' as const },
        { row, col, orientation: 'V' as const },
      ]) {
        // applyAction() validates path preservation when this child is
        // expanded; validating here as well doubled the BFS work.
        add(slot, false);
      }
    }
  }
  for (const foe of st.players) {
    if (foe.id === playerId || foe.status !== 'ACTIVE') continue;
    const blocks = findPathBlockingWalls(st, playerId, foe, horizon);
    for (let i = 0; i < Math.min(8, blocks.length); i++) {
      add(blocks[i].wall, true);
    }
  }
  return me ? styleOrder([...out.values()], wallStyle, me) : [...out.values()];
}

/**
 * Deep-node wall generation. The full horizon scan is reserved for the root:
 * running it at every expanded node made the search an order of magnitude
 * slower than the clock budget allowed. Here we score only the four slots
 * touching each pawn, which is enough to keep tactical blocks in the tree.
 */
function quickWalls(st: GameState, playerId: string): WallCandidate[] {
  const out = new Map<string, WallCandidate>();
  const add = (slot: WallCoord, positive: boolean): void => {
    if (slot.row < 0 || slot.row > 7 || slot.col < 0 || slot.col > 7) return;
    const key = `${slot.row},${slot.col},${slot.orientation}`;
    const existing = out.get(key);
    if (existing) {
      existing.positive = existing.positive || positive;
      return;
    }
    out.set(key, { wall: slot, positive });
  };
  const me = st.players.find((p) => p.id === playerId);
  if (!me) return [];
  const addTouch = (p: GameState['players'][number], positive: boolean): void => {
    const { row, col } = p.position;
    const slots =
      p.goalDirection === 'BOTTOM'
        ? [
            { row, col: col - 1, orientation: 'H' as const },
            { row, col, orientation: 'H' as const },
          ]
        : p.goalDirection === 'TOP'
          ? [
              { row: row - 1, col: col - 1, orientation: 'H' as const },
              { row: row - 1, col, orientation: 'H' as const },
            ]
          : p.goalDirection === 'RIGHT'
            ? [
                { row: row - 1, col, orientation: 'V' as const },
                { row, col, orientation: 'V' as const },
              ]
            : [
                { row: row - 1, col: col - 1, orientation: 'V' as const },
                { row, col: col - 1, orientation: 'V' as const },
              ];
    for (const slot of slots) {
      add(slot, positive);
    }
  };
  addTouch(me, false);
  for (const foe of st.players) {
    if (foe.id === playerId || foe.status !== 'ACTIVE') continue;
    const { row, col } = foe.position;
    const slots =
      foe.goalDirection === 'BOTTOM'
        ? [
            { row, col: col - 1, orientation: 'H' as const },
            { row, col, orientation: 'H' as const },
          ]
        : foe.goalDirection === 'TOP'
          ? [
              { row: row - 1, col: col - 1, orientation: 'H' as const },
              { row: row - 1, col, orientation: 'H' as const },
            ]
          : foe.goalDirection === 'RIGHT'
            ? [
                { row: row - 1, col, orientation: 'V' as const },
                { row, col, orientation: 'V' as const },
              ]
            : [
                { row: row - 1, col: col - 1, orientation: 'V' as const },
                { row, col: col - 1, orientation: 'V' as const },
              ];
    for (const slot of slots) {
      // These are the two slots directly in front of the foe. At depth, treat
      // them as positive without a BFS for self-cost; the root does exact net
      // tempo, and per-node BFS here made the tree several times slower.
      add(slot, true);
    }
  }
  return [...out.values()];
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let lastMctsStats: MctsStats = { simulations: 0, nodes: 0, elapsedMs: 0, bestVisits: 0, bestWinRate: 0 };

export function mctsStats(): MctsStats {
  return lastMctsStats;
}

interface MctsSession {
  simulations: number;
  immediateWinAction?: GameAction | null;
  stepSimulation: () => void;
  finalize: () => GameAction | null;
}

function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function resolveOpeningStyle(
  requested: BotOpeningStyle | undefined,
  state: GameState,
  seed: number
): BotOpeningStyle {
  if (requested && requested !== 'mixed') return requested;
  const styles: BotOpeningStyle[] = ['center_march', 'wing_drift', 'early_fence', 'back_gate'];
  const key = `${state.gameId}:${state.mode}:${seed}`;
  return styles[hashString(key) % styles.length];
}

/** Net race tempo of a wall: opponent delay minus our own delay. */
function actionPrior(
  st: GameState,
  applied: GameState,
  action: GameAction,
  mover: GameState['players'][number],
  openingStyle: BotOpeningStyle,
  wallStyle: BotWallStyle,
  isRoot: boolean,
  wallPositive = true
): number {
  let prior = 0.5;
  const opening = st.moveNumber <= 6;

  if (action.type === 'MOVE') {
    const progress = moveProgress(mover.position, action.to, mover.goalDirection, st.mode);
    prior += 0.055 * progress;
    if (isRoot && progress <= 0) {
      // A shortest-path step is never a pacing loop, so skip the two BFS
      // probes in repetitionPenalty for the common forward case.
      prior -= repetitionPenalty(st, mover.id, action.to) * 0.01;
      const isJump =
        Math.abs(action.to.row - mover.position.row) === 2 ||
        Math.abs(action.to.col - mover.position.col) === 2;
      if (isJump) {
        prior -= jumpTrapPenalty(st, boardOf(st), mover, action) * 0.012;
      }
    }
    if (opening) {
      if (openingStyle === 'wing_drift') {
        prior += action.to.col >= 2 && action.to.col <= 6 && action.to.col !== 4 ? 0.06 : 0;
        prior -= action.to.col === 4 ? 0.045 : 0;
      } else if (openingStyle === 'center_march') {
        prior += action.to.col === 4 ? 0.035 : 0;
      } else if (openingStyle === 'early_fence') {
        prior -= 0.02;
      } else if (openingStyle === 'back_gate') {
        prior += Math.abs(action.to.col - mover.position.col) === 1 ? 0.02 : 0;
      }
    }
  } else if (action.type === 'PLACE_WALL') {
    prior += wallPositive ? 0.06 : -0.07;
    if (wallStyle === 'horizontal_barricade' && action.wall.orientation === 'H') prior += 0.025;
    if (wallStyle === 'vertical_corridor' && action.wall.orientation === 'V') prior += 0.025;
    if (wallStyle === 'flank_trap' && (action.wall.col <= 2 || action.wall.col >= 5)) prior += 0.03;
    if (wallStyle === 'minimal') prior -= 0.04;
    if (opening) {
      if (openingStyle === 'early_fence') prior += 0.09;
      if (openingStyle === 'back_gate') prior += 0.05;
      if (openingStyle === 'wing_drift') prior -= 0.02;
    }
  }
  return Math.max(0.01, Math.min(0.99, prior));
}

function createMctsSession(state: GameState, opts: MctsOptions = {}): MctsSession {
  const started = Date.now();
  const simulations = Math.max(1, Math.floor(opts.simulations ?? 1200));
  const uctConst = opts.uctConst ?? 0.5;
  const maxRollout = Math.max(1, Math.floor(opts.maxRolloutPlies ?? 8));
  const rng = mulberry32(opts.seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const playerCount = state.players.length;

  if (state.status !== 'IN_PROGRESS') {
    return {
      simulations: 0,
      immediateWinAction: null,
      stepSimulation: () => {},
      finalize: () => {
        lastMctsStats = { simulations: 0, nodes: 0, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
        return null;
      },
    };
  }
  const rootMover = state.players[state.currentPlayerIndex];
  if (!rootMover) {
    return {
      simulations: 0,
      immediateWinAction: null,
      stepSimulation: () => {},
      finalize: () => {
        lastMctsStats = { simulations: 0, nodes: 0, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
        return null;
      },
    };
  }

  // 1. Immediate Win: if any move wins the game right now, take it without simulating!
  const legalMoves = getLegalMoves(state, rootMover.id);
  for (const to of legalMoves) {
    if (!isGoalCell(to, rootMover.goalDirection, state.mode)) continue;
    const applied = applyAction(state, { type: 'MOVE', to });
    if (applied.success) {
      const moverAfter = applied.state.players.find((p) => p.id === rootMover.id);
      const winsNow =
        (applied.state.status === 'COMPLETED' && applied.state.winnerId === rootMover.id) ||
        (moverAfter !== undefined && moverAfter.place === 1);
      if (winsNow) {
        lastMctsStats = { simulations: 0, nodes: 1, elapsedMs: Date.now() - started, bestVisits: 1, bestWinRate: 1 };
        return {
          simulations: 0,
          immediateWinAction: { type: 'MOVE', to },
          stepSimulation: () => {},
          finalize: () => ({ type: 'MOVE', to }),
        };
      }
    }
  }

  // 2. Race lead check: a leader only sprints when the opponents are out of
  // walls. The old condition was true on most turns and disabled wall play.
  const myDist = distanceOf(rootMover.position, rootMover.goalDirection, state);
  let minFoeDist = Infinity;
  for (const foe of state.players) {
    if (foe.id !== rootMover.id && foe.status === 'ACTIVE') {
      const d = distanceOf(foe.position, foe.goalDirection, state);
      if (d < minFoeDist) minFoeDist = d;
    }
  }
  const hasCriticalFoe = minFoeDist === 1;
  const allFoesHaveNoWalls = state.players.every(
    (p) => p.id === rootMover.id || p.status !== 'ACTIVE' || p.wallsRemaining === 0
  );
  // Strict lead: ties are not sprints. The old `<=` made the conversion
  // override fire on roughly half of all turns and taught bots to ignore walls.
  const isAhead = myDist < minFoeDist && minFoeDist > 1;
  const clearLead = isAhead && myDist + 2 <= minFoeDist;
  // Only sprint when the opponents have spent their walls. While any wall
  // remains, wall play is part of the game; the old broad condition forced
  // every bot into a 0.05 wall probability on most turns.
  const shouldSprint = allFoesHaveNoWalls && myDist <= minFoeDist && !hasCriticalFoe;

  const wallProb = Math.max(0, Math.min(1, opts.wallMoveProb ?? 0.3));
  const blockProb = Math.max(0, Math.min(1, opts.blockMoveProb ?? 0.35));
  const blunderRate = Math.max(0, Math.min(1, opts.blunderRate ?? 0));
  const missDefenseProb = Math.max(0, Math.min(1, opts.missDefenseProb ?? 0));
  const naiveWallProb = Math.max(0, Math.min(1, opts.naiveWallProb ?? 0));
  const softmaxTemp = Math.max(0.01, opts.softmaxTemp ?? 0.18);
  const varietyWindow = Math.max(0, opts.varietyWindow ?? 0.05);
  const wallStyle = opts.wallStyle ?? 'balanced';
  const openingStyle = resolveOpeningStyle(opts.openingStyle, state, opts.seed ?? 0);
  const configuredHorizon = opts.wallHorizon ?? 6;
  const maxOpeningPly = state.players.length * 2;
  const isOpeningSprint = state.moveNumber <= maxOpeningPly && myDist >= 7 && minFoeDist >= 7;
  const effectiveHorizon = isOpeningSprint ? Math.min(configuredHorizon, 4) : configuredHorizon;

  const newNode = (
    move: GameAction | null,
    parent: MctsNode | null,
    st: GameState,
    prior = 0.5
  ): MctsNode => ({
    move,
    parent,
    children: [],
    state: st,
    moverIndex: st.currentPlayerIndex,
    visits: 0,
    rewards: new Array<number>(playerCount).fill(0),
    terminalWinner: winnerIndexOf(st),
    prior,
  });

  const uct = (node: MctsNode, parentVisits: number, selectorIndex: number): number => {
    const q = node.visits > 0 ? node.rewards[selectorIndex] / node.visits : node.prior;
    const exploration =
      uctConst * node.prior * Math.sqrt(Math.max(1, parentVisits)) / (1 + node.visits);
    return q + exploration;
  };

  const expand = (node: MctsNode): void => {
    const st = node.state;
    const mover = st.players[st.currentPlayerIndex];
    if (!mover) return;
    const legal = getLegalMoves(st, mover.id);
    const moves: GameAction[] = [];

    // Immediate win at every node, not just the root.
    for (const to of legal) {
      if (isGoalCell(to, mover.goalDirection, st.mode)) {
        moves.push({ type: 'MOVE', to });
        break;
      }
    }

    let criticalBlocking = false;
    let missedDefense = false;
    if (moves.length === 0 && mover.wallsRemaining > 0) {
      const critFoe = st.players.find(
        (p) =>
          p.id !== mover.id &&
          p.status === 'ACTIVE' &&
          isOneStepFromGoal(p.position, p.goalDirection, st.mode)
      );
      // Beginner personalities sometimes simply miss the loss threat.
      if (critFoe && rng() >= missDefenseProb) {
        criticalBlocking = true;
        const blocks = findPathBlockingWalls(st, mover.id, critFoe, effectiveHorizon);
        for (const b of blocks) moves.push({ type: 'PLACE_WALL', wall: b.wall });
      } else if (critFoe) {
        missedDefense = true;
      }
    }

    let generatedWalls: WallCandidate[] = [];
    if (moves.length === 0) {
      for (const to of legal) moves.push({ type: 'MOVE', to });
      if (mover.wallsRemaining > 0 && !missedDefense) {
        generatedWalls =
          node.parent === null
            ? probableWalls(st, mover.id, effectiveHorizon, wallStyle, openingStyle)
            : quickWalls(st, mover.id);
        for (const candidate of generatedWalls) {
          // Non-positive walls are decorative. Beginners keep some; stronger
          // bots never pay tempo for them.
          if (!candidate.positive && rng() >= naiveWallProb) continue;
          moves.push({ type: 'PLACE_WALL', wall: candidate.wall });
        }
      }
    }

    const positiveWalls = new Set<string>();
    for (const c of generatedWalls) {
      if (c.positive) {
        positiveWalls.add(`${c.wall.row},${c.wall.col},${c.wall.orientation}`);
      }
    }
    if (criticalBlocking) {
      for (const action of moves) {
        if (action.type === 'PLACE_WALL') {
          positiveWalls.add(`${action.wall.row},${action.wall.col},${action.wall.orientation}`);
        }
      }
    }

    shuffleInPlace(moves, rng);
    for (const action of moves) {
      const applied = applyAction(st, action);
      if (!applied.success) continue;
      const wallPositive =
        action.type === 'PLACE_WALL'
          ? positiveWalls.has(`${action.wall.row},${action.wall.col},${action.wall.orientation}`)
          : true;
      const prior = actionPrior(
        st,
        applied.state,
        action,
        mover,
        openingStyle,
        wallStyle,
        node.parent === null,
        wallPositive
      );
      node.children.push(newNode(action, node, applied.state, prior));
    }
  };

  const outcomeOf = (winner: number | null): number[] => {
    const out = new Array<number>(playerCount).fill(0);
    if (winner === null || winner < 0) {
      out.fill(0.5);
    } else if (winner >= 0 && winner < playerCount) {
      out[winner] = 1;
    }
    return out;
  };

  const stateOutcome = (s: GameState): number[] => {
    const term = winnerIndexOf(s);
    if (term !== null) return outcomeOf(term);
    const dists = s.players.map((p) =>
      p.status === 'ACTIVE'
        ? getShortestDistance(p.position, p.goalDirection, s.walls, s.mode)
        : Infinity
    );
    if (playerCount === 2) {
      const d0 = Number.isFinite(dists[0]) ? dists[0] : 99;
      const d1 = Number.isFinite(dists[1]) ? dists[1] : 99;
      const turnBonus = s.currentPlayerIndex === 0 ? 0.5 : -0.5;
      const wallBonus = ((s.players[0]?.wallsRemaining ?? 0) - (s.players[1]?.wallsRemaining ?? 0)) * 0.35;
      const p0 = 1 / (1 + Math.exp(-((d1 - d0 + turnBonus + wallBonus) / 3.2)));
      return [p0, 1 - p0];
    }
    let bestDist = Infinity;
    for (const d of dists) {
      if (d < bestDist) bestDist = d;
    }
    if (!Number.isFinite(bestDist)) return outcomeOf(-1);
    const avgWalls =
      s.players.reduce((sum, p) => sum + (p.status === 'ACTIVE' ? p.wallsRemaining : 0), 0) /
      Math.max(1, s.players.filter((p) => p.status === 'ACTIVE').length);
    const out = new Array<number>(playerCount).fill(0);
    let sum = 0;
    for (let i = 0; i < playerCount; i++) {
      const d = dists[i];
      if (!Number.isFinite(d)) {
        out[i] = 0;
      } else {
        const wallBonus = ((s.players[i]?.wallsRemaining ?? 0) - avgWalls) * 0.02;
        const val = Math.exp(-0.4 * (d - bestDist) + wallBonus);
        out[i] = val;
        sum += val;
      }
    }
    if (sum > 0) {
      for (let i = 0; i < playerCount; i++) out[i] /= sum;
    } else {
      out.fill(1 / playerCount);
    }
    return out;
  };

  const rollout = (st0: GameState): number[] => {
    let st = st0;
    for (let ply = 0; ply < maxRollout; ply++) {
      const term = winnerIndexOf(st);
      if (term !== null) return outcomeOf(term);
      const mover = st.players[st.currentPlayerIndex];
      if (!mover) break;
      let action: GameAction | null = null;
      // 1. Immediate win in rollout: if mover is 1 step from goal, step in!
      if (isOneStepFromGoal(mover.position, mover.goalDirection, st.mode)) {
        const step = nextPathStep(st, mover);
        if (step) action = { type: 'MOVE', to: { ...step } };
      }
      // 2. Critical defense in rollout: if a foe is 1 step from goal and mover has walls, block!
      if (!action && mover.wallsRemaining > 0) {
        const crit = st.players.find(
          (p) =>
            p.id !== mover.id &&
            p.status === 'ACTIVE' &&
            isOneStepFromGoal(p.position, p.goalDirection, st.mode)
        );
        if (crit) {
          const slot = findBlockingWall(st, mover.id, crit, effectiveHorizon);
          if (slot) action = { type: 'PLACE_WALL', wall: slot };
        }
      }
      const r = rng();
      if (!action && r < 1 - wallProb) {
        // March along a shortest path. Never step backwards voluntarily.
        const step = nextPathStep(st, mover);
        if (step) action = { type: 'MOVE', to: { ...step } };
      }
      if (!action && mover.wallsRemaining > 0) {
        // Prefer cutting a real opponent's route over a decorative wall.
        if (rng() < blockProb) {
          const foes = st.players.filter((p) => p.id !== mover.id && p.status === 'ACTIVE');
          for (let i = foes.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [foes[i], foes[j]] = [foes[j], foes[i]];
          }
          for (const foe of foes) {
            const slot = findBlockingWall(st, mover.id, foe, effectiveHorizon);
            if (slot) {
              action = { type: 'PLACE_WALL', wall: slot };
              break;
            }
          }
        }
      }
      if (!action && mover.wallsRemaining > 0) {
        const walls = quickWalls(st, mover.id);
        const positive = walls.filter((c) => c.positive);
        const pool = positive.length > 0 ? positive : walls;
        if (pool.length > 0 && rng() < 0.5) {
          const candidate = pool[Math.floor(rng() * pool.length)];
          action = { type: 'PLACE_WALL', wall: candidate.wall };
        }
      }
      if (!action) {
        const legal = getLegalMoves(st, mover.id);
        if (legal.length === 0) break;
        const forward = legal.filter(
          (to) => moveProgress(mover.position, to, mover.goalDirection, st.mode) >= 0
        );
        const pool = forward.length > 0 ? forward : legal;
        const to = pool[Math.floor(rng() * pool.length)];
        action = { type: 'MOVE', to: { ...to } };
      }
      const applied = applyAction(st, action);
      if (!applied.success) {
        return stateOutcome(st);
      }
      st = applied.state;
    }
    return stateOutcome(st);
  };

  const root: MctsNode = newNode(null, null, state);
  let nodeCount = 1;
  let rootExpanded = false;
  const ensureRoot = (): void => {
    if (rootExpanded) return;
    expand(root);
    nodeCount += root.children.length;
    rootExpanded = true;
  };

  const stepSimulation = (): void => {
    ensureRoot();
    // Selection: descend PUCT-best while fully expanded.
    let node = root;
    const path: MctsNode[] = [root];
    while (node.children.length > 0 && node.terminalWinner === null) {
      let best: MctsNode | null = null;
      let bestUct = -Infinity;
      const selectorIndex = node.state.currentPlayerIndex;
      for (const child of node.children) {
        const u = uct(child, node.visits, selectorIndex);
        if (u > bestUct) {
          bestUct = u;
          best = child;
        }
      }
      if (!best) break;
      node = best;
      path.push(node);
    }
    let outcome: number[];
    if (node.terminalWinner !== null) {
      outcome = outcomeOf(node.terminalWinner);
    } else if (node.visits === 0) {
      // Direct leaf evaluation on first visit
      outcome = rollout(node.state);
    } else {
      if (node.children.length === 0) {
        expand(node);
        nodeCount += node.children.length;
      }
      if (node.children.length > 0) {
        const child = node.children[Math.floor(rng() * node.children.length)];
        path.push(child);
        outcome = rollout(child.state);
      } else {
        outcome = rollout(node.state);
      }
    }
    for (const n of path) {
      n.visits++;
      for (let i = 0; i < playerCount; i++) n.rewards[i] += outcome[i];
    }
  };

  const finalize = (): GameAction | null => {
    ensureRoot();
    if (root.children.length === 0) {
      const legal = getLegalMoves(state, rootMover.id);
      if (legal.length > 0) {
        lastMctsStats = { simulations, nodes: nodeCount, elapsedMs: Date.now() - started, bestVisits: 1, bestWinRate: 0.5 };
        return { type: 'MOVE', to: legal[0] };
      }
      lastMctsStats = { simulations, nodes: nodeCount, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
      return null;
    }

    const rootMoverIndex = rootMover.index;
    // Visit stabilization prevents a 1-visit fluke from winning the softmax.
    const qOf = (child: MctsNode): number => {
      const priorVisits = 6;
      return (
        (child.rewards[rootMoverIndex] + child.prior * priorVisits) /
        (child.visits + priorVisits)
      );
    };

    let best = root.children[0];
    let bestQ = qOf(best);
    for (const child of root.children) {
      const q = qOf(child);
      if (q > bestQ || (q === bestQ && child.visits > best.visits)) {
        best = child;
        bestQ = q;
      }
    }

    let chosen = best;
    let blundered = false;
    const rootVisits = root.visits;
    if (blunderRate > 0 && rng() < blunderRate) {
      const alternatives = root.children.filter((c) => c !== best);
      const pawnAlternatives = alternatives
        .filter((c) => c.move?.type === 'MOVE')
        .sort((a, b) => qOf(b) - qOf(a));
      const pool = pawnAlternatives.length > 0 ? pawnAlternatives : alternatives;
      if (pool.length > 0) {
        chosen = pool[Math.floor(rng() * Math.min(3, pool.length))];
        blundered = true;
      }
    } else {
      const minVisits = Math.max(2, Math.ceil(rootVisits * 0.055));
      const eligible = root.children.filter(
        (c) => c.visits >= minVisits && qOf(c) >= bestQ - varietyWindow
      );
      if (eligible.length > 1) {
        const weights = eligible.map((c) => Math.exp((qOf(c) - bestQ) / softmaxTemp));
        const total = weights.reduce((sum, w) => sum + w, 0);
        let pick = rng() * total;
        for (let i = 0; i < eligible.length; i++) {
          pick -= weights[i];
          if (pick <= 0) {
            chosen = eligible[i];
            break;
          }
        }
      }
    }

    // Conversion beats decoration. A shortest-path step is always available,
    // so the bot should never voluntarily shuffle sideways or backwards when
    // it could advance. Walls can still win the sample when they are clearly
    // better (or when the bot is in a close race and trying to funnel).
    const currentDist = distanceOf(rootMover.position, rootMover.goalDirection, state);
    const moveDistances = new Map<MctsNode, number>();
    for (const child of root.children) {
      if (child.move?.type !== 'MOVE') continue;
      const to = (child.move as { type: 'MOVE'; to: CellCoord }).to;
      moveDistances.set(child, distanceOf(to, rootMover.goalDirection, state));
    }
    const forwardMoves = root.children
      .filter((c) => moveDistances.has(c) && (moveDistances.get(c) as number) < currentDist)
      .sort((a, b) => qOf(b) - qOf(a));
    if (forwardMoves.length > 0) {
      const bestForward = forwardMoves[0];
      const chosenDist = moveDistances.get(chosen);
      const chosenIsForward = chosenDist !== undefined && chosenDist < currentDist;
      // A deliberate beginner blunder may take a fresh sideways step and make
      // matches feel human. It may never be an immediate reverse or a revisit:
      // that is how the old bots paced the same corridor forever.
      const safeBlunder =
        blundered &&
        chosen.move?.type === 'MOVE' &&
        repetitionPenalty(state, rootMover.id, chosen.move.to) === 0;
      if (!chosenIsForward && !safeBlunder) {
        if (chosen.move?.type === 'MOVE') {
          chosen = bestForward;
        }
      }
    }

    const chosenQ = qOf(chosen);
    lastMctsStats = {
      simulations,
      nodes: nodeCount,
      elapsedMs: Date.now() - started,
      bestVisits: chosen.visits,
      bestWinRate: chosenQ,
    };

    // Losing-rescue: if we have NO walls left and collapsing, march along shortest path
    if (chosenQ < 0.1 && rootMover.wallsRemaining === 0) {
      const step = nextPathStep(state, rootMover);
      if (step && getLegalMoves(state, rootMover.id).some((c) => c.row === step.row && c.col === step.col)) {
        lastMctsStats.elapsedMs = Date.now() - started;
        return { type: 'MOVE', to: { ...step } };
      }
    }
    return chosen.move;
  };

  return { simulations, stepSimulation, finalize };
}

export function mctsBestAction(state: GameState, opts: MctsOptions = {}): GameAction | null {
  const session = createMctsSession(state, opts);
  if (session.immediateWinAction !== undefined) return session.immediateWinAction;
  const deadline = opts.timeBudgetMs ? Date.now() + opts.timeBudgetMs : Infinity;
  for (let sim = 0; sim < session.simulations; sim++) {
    if (sim > 16 && (sim & 15) === 0 && Date.now() >= deadline) {
      break;
    }
    session.stepSimulation();
  }
  return session.finalize();
}

/** performance.now when available (web), Date.now otherwise (Hermes). */
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export async function mctsBestActionAsync(
  state: GameState,
  opts: MctsOptions = {},
  hooks?: { shouldCancel?: () => boolean }
): Promise<GameAction | null> {
  const session = createMctsSession(state, opts);
  if (session.immediateWinAction !== undefined) return session.immediateWinAction;
  const deadline = opts.timeBudgetMs ? Date.now() + opts.timeBudgetMs : Infinity;
  const MAX_SLICE_MS = 4.5;
  let i = 0;
  while (i < session.simulations) {
    if (hooks?.shouldCancel?.()) return null;
    if (Date.now() >= deadline) break;
    const sliceStart = nowMs();
    do {
      session.stepSimulation();
      i++;
    } while (
      i < session.simulations &&
      nowMs() - sliceStart < MAX_SLICE_MS &&
      Date.now() < deadline
    );
    if (i < session.simulations && Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  return session.finalize();
}
